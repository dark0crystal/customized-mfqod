import React, { useEffect, useState } from 'react';
import { Building, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';
import type * as Leaflet from 'leaflet';
// Marker images are bundled by Vite (no CDN): an air-gapped network has no internet access.
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { MAP_ATTRIBUTION, MAP_TILES_TYPE, MAP_TILES_URL } from '@/config';

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  description_ar?: string;
  description_en?: string;
  longitude?: number;
  latitude?: number;
  organization_id: string;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

interface Organization {
  id: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
}

interface BranchMapProps {
  branches: Branch[];
  organizations: Organization[];
}

// Client-only component to handle map initialization
const ClientOnlyMap = ({ children }: { children: React.ReactNode }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ported 1:1
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{borderColor: '#3277AE'}}></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Component to fit map bounds to show all markers
function FitBounds(_props: { branches: Branch[] }) {
  // For now, we'll skip the fitBounds functionality to avoid SSR issues
  // This can be implemented later with proper client-side map handling
  return null;
}

// Dynamic map component that loads react-leaflet components
// Base map layer, chosen at runtime from /config.js (see src/config.ts):
//   'pmtiles' -> self-hosted Protomaps vector basemap (MAP_TILES_URL, e.g. /map/oman.pmtiles)
//   'xyz'     -> raster tile server template (MAP_TILES_URL, an internal server ending in /{z}/{x}/{y}.png)
//   'none'    -> no base layer (markers only)
const MapComponent = React.lazy(() => {
  return Promise.all([
    import('react-leaflet'),
    import('leaflet'),
    MAP_TILES_TYPE === 'pmtiles' ? import('protomaps-leaflet') : Promise.resolve(null),
  ]).then(([{ MapContainer, TileLayer, Marker, Popup, useMap }, L, protomaps]) => {
    // Fix for default markers in react-leaflet
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2xUrl,
      iconUrl: markerIconUrl,
      shadowUrl: markerShadowUrl,
    });

    // protomaps-leaflet extends the global `L` (L.GridLayer), so expose the bundled Leaflet instance.
    const leafletGlobal = (L as unknown as { default?: typeof Leaflet }).default ?? (L as unknown as typeof Leaflet);
    const win = window as unknown as { L?: typeof Leaflet };
    if (protomaps && !win.L) win.L = leafletGlobal;

    const ProtomapsBaseLayer = ({ lang }: { lang: string }) => {
      const map = useMap();
      useEffect(() => {
        if (!protomaps) return;
        const layer = protomaps.leafletLayer({
          url: MAP_TILES_URL,
          flavor: 'light',
          lang,
          attribution: MAP_ATTRIBUTION,
          maxZoom: 18, // same zoom limit as the previous OpenStreetMap TileLayer
        }) as unknown as Leaflet.Layer;
        layer.addTo(map);
        return () => {
          map.removeLayer(layer);
        };
      }, [map, lang]);
      return null;
    };

    return {
      default: ({ 
        branches, 
        organizations, 
        defaultCenter, 
        getLocalizedBranchName, 
        getLocalizedOrganizationName, 
        getLocalizedBranchDescription, 
        getLocalizedOrganizationDescription, 
        t,
        locale
      }: {
        branches: Branch[];
        organizations: Organization[];
        defaultCenter: [number, number];
        getLocalizedBranchName: (branch: Branch) => string;
        getLocalizedOrganizationName: (organization: Organization) => string;
        getLocalizedBranchDescription: (branch: Branch) => string;
        getLocalizedOrganizationDescription: (organization: Organization) => string;
        t: (key: string) => string;
        locale: string;
      }) => (
        <div className="w-full h-[500px] rounded-lg overflow-hidden shadow-lg">
          <MapContainer
            center={defaultCenter}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            {MAP_TILES_TYPE === 'pmtiles' && <ProtomapsBaseLayer lang={locale} />}
            {MAP_TILES_TYPE === 'xyz' && (
              <TileLayer
                attribution={MAP_ATTRIBUTION}
                url={MAP_TILES_URL}
              />
            )}
            
            <FitBounds branches={branches} />
            
            {branches.map((branch) => {
              const organization = organizations.find((org: Organization) => org.id === branch.organization_id);
              const branchName = getLocalizedBranchName(branch);
              const organizationName = organization ? getLocalizedOrganizationName(organization) : '';
              const branchDescription = getLocalizedBranchDescription(branch);
              const organizationDescription = organization ? getLocalizedOrganizationDescription(organization) : '';
              
              return (
                <Marker
                  key={branch.id}
                  position={[branch.latitude!, branch.longitude!]}
                  icon={new L.Icon({
                    iconUrl: markerIconUrl,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowUrl: markerShadowUrl,
                    shadowSize: [41, 41]
                  })}
                >
                  <Popup>
                    <div className="p-2 min-w-[250px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Building size={16} style={{color: '#3277AE'}} />
                        <h3 className="font-semibold text-gray-800 text-sm">{branchName}</h3>
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <p className="text-gray-600">
                          <span className="font-medium">{t('organization')}:</span> {organizationName}
                        </p>
                        
                        {organizationDescription && (
                          <p className="text-gray-500">
                            <span className="font-medium">{t('description')}:</span> {organizationDescription}
                          </p>
                        )}
                        
                        {branchDescription && (
                          <p className="text-gray-500">
                            <span className="font-medium">{t('branchDescription')}:</span> {branchDescription}
                          </p>
                        )}
                        
                        <p className="text-gray-500 font-mono text-xs">
                          <span className="font-medium">{t('coordinates')}:</span> 
                          <br />
                          {branch.latitude!.toFixed(6)}, {branch.longitude!.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )
    };
  });
});

export default function BranchMap({ branches, organizations }: BranchMapProps) {
  const locale = useLocale();
  const t = useTranslations('branchesInfo');

  const getLocalizedBranchName = (branch: Branch) => {
    if (locale === 'ar' && branch.branch_name_ar) {
      return branch.branch_name_ar;
    }
    if (locale === 'en' && branch.branch_name_en) {
      return branch.branch_name_en;
    }
    return branch.branch_name_ar || branch.branch_name_en || t('unnamedBranch');
  };

  const getLocalizedOrganizationName = (organization: Organization) => {
    if (!organization) return '';
    if (locale === 'ar' && organization.name_ar) {
      return organization.name_ar;
    }
    if (locale === 'en' && organization.name_en) {
      return organization.name_en;
    }
    return organization.name_ar || organization.name_en || '';
  };

  const getLocalizedBranchDescription = (branch: Branch) => {
    if (locale === 'ar' && branch.description_ar) {
      return branch.description_ar;
    }
    if (locale === 'en' && branch.description_en) {
      return branch.description_en;
    }
    return branch.description_ar || branch.description_en || '';
  };

  const getLocalizedOrganizationDescription = (organization: Organization) => {
    if (!organization) return '';
    if (locale === 'ar' && organization.description_ar) {
      return organization.description_ar;
    }
    if (locale === 'en' && organization.description_en) {
      return organization.description_en;
    }
    return organization.description_ar || organization.description_en || '';
  };

  // Filter branches that have valid coordinates
  const branchesWithCoordinates = branches.filter(branch => 
    branch.latitude && branch.longitude && 
    !isNaN(branch.latitude) && !isNaN(branch.longitude)
  );

  // Default center (can be adjusted based on your region)
  const defaultCenter: [number, number] = [23.591382, 58.171158]; // Muscat, Oman

  if (branchesWithCoordinates.length === 0) {
    return (
      <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noBranchesWithCoordinates')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('noCoordinatesMessage')}</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnlyMap>
      <React.Suspense fallback={
        <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{borderColor: '#3277AE'}}></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      }>
        <MapComponent 
          branches={branchesWithCoordinates}
          organizations={organizations}
          defaultCenter={defaultCenter}
          getLocalizedBranchName={getLocalizedBranchName}
          getLocalizedOrganizationName={getLocalizedOrganizationName}
          getLocalizedBranchDescription={getLocalizedBranchDescription}
          getLocalizedOrganizationDescription={getLocalizedOrganizationDescription}
          t={t}
          locale={locale}
        />
      </React.Suspense>
    </ClientOnlyMap>
  );
}