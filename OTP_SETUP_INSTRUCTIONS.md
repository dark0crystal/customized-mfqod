# OTP Email Verification Setup Instructions

## Step 1: Run Database Migration

The `email_verifications` table needs to be created in your database. Run the following command:

```bash
cd backend/app/db
alembic upgrade head
```

Or from the backend directory:

```bash
cd backend
python3 -m alembic -c app/db/alembic.ini upgrade head
```

## Step 2: Verify Migration

Check that the table was created:

```bash
# Connect to your database and verify
psql -d your_database_name -c "\d email_verifications"
```

Or check via Python:

```python
from app.db.database import get_session
from app.models import EmailVerification
from sqlalchemy import inspect

session = next(get_session())
inspector = inspect(session.bind)
tables = inspector.get_table_names()
print("email_verifications" in tables)  # Should print True
```

## Step 3: Test the Endpoints

1. **Send OTP:**
   ```bash
   curl -X POST http://localhost:8000/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. **Verify OTP:**
   ```bash
   curl -X POST http://localhost:8000/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "otp_code": "123456"}'
   ```

## Step 4: Check Backend Logs

If there are errors, check the backend logs:

```bash
tail -f backend/logs/application.log
tail -f backend/logs/errors.log
```

## Common Issues

### Issue 1: Table doesn't exist
**Error:** `relation "email_verifications" does not exist`

**Solution:** Run the migration (Step 1)

### Issue 2: Import errors
**Error:** `cannot import name 'EmailVerification'`

**Solution:** Make sure you've restarted the backend server after adding the model

### Issue 3: Email not sending
**Error:** OTP generated but email not received

**Solution:** 
- Check email configuration in `.env` file
- Verify SMTP settings are correct
- Check `EMAIL_ENABLED=true` in environment variables
- Check backend logs for email sending errors

### Issue 4: Frontend API errors
**Error:** Network errors or 404

**Solution:**
- Verify backend is running on correct port
- Check CORS settings in `main.py`
- Verify API endpoint URLs in frontend match backend routes

## Testing the Full Flow

1. Open the registration page
2. Fill in the registration form
3. Click "Create Account" - this should send OTP
4. Check your email for the 6-digit code
5. Enter the code in the OTP input field
6. Click "Verify Email"
7. Account should be created and you'll be redirected to login

## Debugging

If something still doesn't work:

1. **Check browser console** for frontend errors
2. **Check network tab** to see API request/response
3. **Check backend logs** for server-side errors
4. **Verify database** has the `email_verifications` table
5. **Test endpoints directly** using curl or Postman



