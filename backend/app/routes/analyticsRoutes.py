from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text, and_, or_
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.db.database import get_session
from app.models import Item, ItemType, Claim, User, Address
from app.middleware.auth_middleware import get_current_user_required
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Public statistics model (no authentication required)
class PublicStatistics(BaseModel):
    total_items: int
    returned_items: int

# Pydantic models for analytics responses
class AnalyticsSummary(BaseModel):
    total_items: int
    lost_items: int
    found_items: int
    returned_items: int
    return_rate: float

class ItemsByDate(BaseModel):
    date: str
    lost: int
    found: int
    returned: int

class ItemsByCategory(BaseModel):
    category: str
    count: int

class ReturnStats(BaseModel):
    period: str
    returned: int
    total: int
    rate: float

class AnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    items_by_date: List[ItemsByDate]
    items_by_category: List[ItemsByCategory]
    return_stats: List[ReturnStats]

@router.get("/analytics/public/stats", response_model=PublicStatistics, tags=["Analytics"])
async def get_public_statistics(
    db: Session = Depends(get_session)
):
    """
    Get public statistics for the index page (no authentication required)
    Returns total items and returned items count
    """
    try:
        # Count total approved items (not deleted)
        # Use the same pattern as ItemService.get_items() for consistency
        total_items_query = db.query(func.count(Item.id)).filter(
            Item.approval == True,
            Item.temporary_deletion == False
        )
        total_items = total_items_query.scalar() or 0
        
        # Count returned items (items with approved_claim_id)
        # An item is "returned" when it has an approved claim
        returned_items_query = db.query(func.count(Item.id)).filter(
            Item.approval == True,
            Item.temporary_deletion == False,
            Item.approved_claim_id.isnot(None)
        )
        returned_items = returned_items_query.scalar() or 0
        
        logger.info(f"Public statistics generated: total_items={total_items}, returned_items={returned_items}")
        
        return PublicStatistics(
            total_items=total_items,
            returned_items=returned_items
        )
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Error generating public statistics: {str(e)}\nTraceback:\n{error_traceback}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating public statistics: {str(e)}"
        )

@router.get("/analytics/summary", response_model=AnalyticsResponse, tags=["Analytics"])
async def get_analytics_summary(
    start_date: Optional[date] = Query(None, description="Start date for analytics (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for analytics (YYYY-MM-DD)"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type ID"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user_required)
):
    """
    Get comprehensive analytics summary for the specified date range
    """
    try:
        # Set default date range if not provided (last 30 days)
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Convert dates to datetime for filtering
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        logger.info(f"Generating analytics from {start_date} to {end_date} for user {current_user.username or current_user.email}")
        
        # Base query filters
        date_filter = and_(
            Item.created_at >= start_datetime,
            Item.created_at <= end_datetime,
            Item.temporary_deletion == False
        )
        
        # Add optional filters - branch filtering through Address relationship
        if branch_id:
            date_filter = and_(date_filter, Item.addresses.any(Address.branch_id == branch_id))
        if item_type_id:
            date_filter = and_(date_filter, Item.item_type_id == item_type_id)
        
        # Summary Statistics
        # Use func.count with explicit column to avoid selecting all columns (including missing approved_claim_id)
        total_items = db.query(func.count(Item.id)).filter(date_filter).scalar() or 0
        
        # Since there's no status field, we'll consider all approved items as "found items"
        # and items with approved claims as "returned items"
        found_items = total_items  # All items in system are found/reported items
        
        # Count returned items (items with approved_claim_id)
        # An item is "returned" when it has an approved claim assigned
        returned_items = db.query(func.count(Item.id)).filter(
            date_filter,
            Item.approved_claim_id.isnot(None)
        ).scalar() or 0
        
        # Lost items would be items not yet returned (found but not claimed)
        lost_items = total_items - returned_items
        
        # Calculate return rate
        return_rate = (returned_items / lost_items * 100) if lost_items > 0 else 0.0
        
        # Items by date (daily breakdown)
        daily_stats = []
        current_date = start_date
        while current_date <= end_date:
            day_start = datetime.combine(current_date, datetime.min.time())
            day_end = datetime.combine(current_date, datetime.max.time())
            
            day_filter = and_(
                Item.created_at >= day_start,
                Item.created_at <= day_end,
                Item.temporary_deletion == False
            )
            
            if branch_id:
                day_filter = and_(day_filter, Item.addresses.any(Address.branch_id == branch_id))
            if item_type_id:
                day_filter = and_(day_filter, Item.item_type_id == item_type_id)
            
            daily_found = db.query(func.count(Item.id)).filter(day_filter).scalar() or 0
            
            daily_returned = db.query(func.count(Item.id)).filter(
                day_filter,
                Item.approved_claim_id.isnot(None)
            ).scalar() or 0
            
            daily_lost = daily_found - daily_returned
            
            daily_stats.append(ItemsByDate(
                date=current_date.strftime('%Y-%m-%d'),
                lost=daily_lost,
                found=daily_found,
                returned=daily_returned
            ))
            
            current_date += timedelta(days=1)
        
        # Items by category (item types)
        category_stats = db.query(
            ItemType.name_en.label('category'),
            func.count(Item.id).label('count')
        ).join(Item).filter(date_filter).group_by(ItemType.name_en).all()
        
        items_by_category = [
            ItemsByCategory(category=stat.category or 'Unknown', count=stat.count)
            for stat in category_stats
        ]
        
        # Return statistics by period
        return_stats = []
        
        # This week
        week_start = date.today() - timedelta(days=date.today().weekday())
        week_end = week_start + timedelta(days=6)
        week_filter = and_(
            Item.created_at >= datetime.combine(week_start, datetime.min.time()),
            Item.created_at <= datetime.combine(week_end, datetime.max.time()),
            Item.temporary_deletion == False
        )
        
        if branch_id:
            week_filter = and_(week_filter, Item.addresses.any(Address.branch_id == branch_id))
        if item_type_id:
            week_filter = and_(week_filter, Item.item_type_id == item_type_id)
        
        week_total = db.query(func.count(Item.id)).filter(week_filter).scalar() or 0
        week_returned = db.query(func.count(Item.id)).filter(week_filter, Item.approved_claim_id.isnot(None)).scalar() or 0
        
        return_stats.append(ReturnStats(
            period="This Week",
            returned=week_returned,
            total=week_total,
            rate=(week_returned / week_total * 100) if week_total > 0 else 0.0
        ))
        
        # This month
        month_start = date.today().replace(day=1)
        month_filter = and_(
            Item.created_at >= datetime.combine(month_start, datetime.min.time()),
            Item.created_at <= end_datetime,
            Item.temporary_deletion == False
        )
        
        if branch_id:
            month_filter = and_(month_filter, Item.addresses.any(Address.branch_id == branch_id))
        if item_type_id:
            month_filter = and_(month_filter, Item.item_type_id == item_type_id)
        
        month_total = db.query(func.count(Item.id)).filter(month_filter).scalar() or 0
        month_returned = db.query(func.count(Item.id)).filter(month_filter, Item.approved_claim_id.isnot(None)).scalar() or 0
        
        return_stats.append(ReturnStats(
            period="This Month",
            returned=month_returned,
            total=month_total,
            rate=(month_returned / month_total * 100) if month_total > 0 else 0.0
        ))
        
        # Last month
        if month_start.month == 1:
            last_month_start = month_start.replace(year=month_start.year - 1, month=12)
        else:
            last_month_start = month_start.replace(month=month_start.month - 1)
        
        last_month_end = month_start - timedelta(days=1)
        last_month_filter = and_(
            Item.created_at >= datetime.combine(last_month_start, datetime.min.time()),
            Item.created_at <= datetime.combine(last_month_end, datetime.max.time()),
            Item.temporary_deletion == False
        )
        
        if branch_id:
            last_month_filter = and_(last_month_filter, Item.addresses.any(Address.branch_id == branch_id))
        if item_type_id:
            last_month_filter = and_(last_month_filter, Item.item_type_id == item_type_id)
        
        last_month_total = db.query(func.count(Item.id)).filter(last_month_filter).scalar() or 0
        last_month_returned = db.query(func.count(Item.id)).filter(last_month_filter, Item.approved_claim_id.isnot(None)).scalar() or 0
        
        return_stats.append(ReturnStats(
            period="Last Month",
            returned=last_month_returned,
            total=last_month_total,
            rate=(last_month_returned / last_month_total * 100) if last_month_total > 0 else 0.0
        ))
        
        # Prepare response
        summary = AnalyticsSummary(
            total_items=total_items,
            lost_items=lost_items,
            found_items=found_items,
            returned_items=returned_items,
            return_rate=return_rate
        )
        
        response = AnalyticsResponse(
            summary=summary,
            items_by_date=daily_stats,
            items_by_category=items_by_category,
            return_stats=return_stats
        )
        
        logger.info(f"Analytics generated successfully: {total_items} total items, {return_rate:.1f}% return rate")
        return response
        
    except Exception as e:
        logger.error(f"Error generating analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating analytics: {str(e)}")

@router.get("/analytics/export-data", tags=["Analytics"])
async def get_analytics_export_data(
    start_date: Optional[date] = Query(None, description="Start date for export (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for export (YYYY-MM-DD)"),
    format: str = Query("json", description="Export format: json, csv"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    item_type_id: Optional[str] = Query(None, description="Filter by item type ID"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user_required)
):
    """
    Export analytics data in various formats for external processing
    """
    try:
        # Get analytics data using the same logic as summary endpoint
        analytics_data = await get_analytics_summary(
            start_date=start_date,
            end_date=end_date,
            branch_id=branch_id,
            item_type_id=item_type_id,
            db=db,
            current_user=current_user
        )
        
        if format.lower() == "csv":
            # Convert to CSV format (simplified for this example)
            csv_data = {
                "summary": [
                    ["Metric", "Value"],
                    ["Total Items", analytics_data.summary.total_items],
                    ["Lost Items", analytics_data.summary.lost_items],
                    ["Found Items", analytics_data.summary.found_items],
                    ["Returned Items", analytics_data.summary.returned_items],
                    ["Return Rate (%)", analytics_data.summary.return_rate],
                ],
                "daily_breakdown": [
                    ["Date", "Lost", "Found", "Returned"]
                ] + [
                    [item.date, item.lost, item.found, item.returned]
                    for item in analytics_data.items_by_date
                ],
                "category_breakdown": [
                    ["Category", "Count"]
                ] + [
                    [item.category, item.count]
                    for item in analytics_data.items_by_category
                ]
            }
            return csv_data
        
        # Default to JSON
        return analytics_data
        
    except Exception as e:
        logger.error(f"Error exporting analytics data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting analytics data: {str(e)}")

@router.get("/analytics/performance-metrics", tags=["Analytics"])
async def get_performance_metrics(
    period: str = Query("30d", description="Time period: 7d, 30d, 90d, 1y"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user_required)
):
    """
    Get system performance metrics for the specified period
    """
    try:
        # Parse period
        if period == "7d":
            days = 7
        elif period == "30d":
            days = 30
        elif period == "90d":
            days = 90
        elif period == "1y":
            days = 365
        else:
            days = 30
        
        start_date = datetime.now() - timedelta(days=days)
        
        # Average response time for item reporting
        avg_claim_processing_time = db.execute(text("""
            SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_hours
            FROM claim 
            WHERE status = 'approved' 
            AND created_at >= :start_date
        """), {"start_date": start_date}).scalar()
        
        # Items resolved per day
        items_per_day = db.execute(text("""
            SELECT AVG(daily_count) as avg_per_day
            FROM (
                SELECT DATE(created_at) as day, COUNT(*) as daily_count
                FROM claim
                WHERE status = 'approved'
                AND created_at >= :start_date
                GROUP BY DATE(created_at)
            ) daily_stats
        """), {"start_date": start_date}).scalar()
        
        # User engagement metrics
        active_users = db.query(func.count(func.distinct(User.id))).filter(
            User.last_login >= start_date
        ).scalar()
        
        total_users = db.query(func.count(User.id)).scalar()
        
        metrics = {
            "period": period,
            "avg_claim_processing_hours": round(avg_claim_processing_time or 0, 2),
            "avg_items_resolved_per_day": round(items_per_day or 0, 2),
            "active_users": active_users or 0,
            "total_users": total_users or 0,
            "user_engagement_rate": round((active_users / total_users * 100) if total_users > 0 else 0, 2)
        }
        
        logger.info(f"Performance metrics generated for period {period}")
        return metrics
        
    except Exception as e:
        logger.error(f"Error generating performance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating performance metrics: {str(e)}")