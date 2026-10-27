// src/features/asset-detail/components/profile/asset-profile-tab.tsx

import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import {
  Briefcase,
  Building,
  ExternalLink,
  Globe,
  UserCircle,
  Users,
  FileText
} from 'lucide-react';
import { CompanyInfoItem } from './company-info-item';
import { formatLargeNumber } from '../../lib/asset-formatters';
import type { AssetData } from '../../../../types/dashboard';

interface AssetProfileTabProps {
  asset: AssetData;
}

export function AssetProfileTab({ asset }: AssetProfileTabProps) {
  // Acceso directo al perfil del activo
  const { profile } = asset;

  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* Información General */}
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Perfil Corporativo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
            {profile.description || "No hay descripción disponible."}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
            <CompanyInfoItem
              icon={<Building className="w-4 h-4" />}
              label="Sector"
              value={profile.sector ?? ''}
            />
            <CompanyInfoItem
              icon={<Briefcase className="w-4 h-4" />}
              label="Industria"
              value={profile.industry ?? ''}
            />
            <CompanyInfoItem
              icon={<UserCircle className="w-4 h-4" />}
              label="CEO"
              value={profile.ceo ?? ''}
            />
            <CompanyInfoItem
              icon={<Users className="w-4 h-4" />}
              label="Empleados"
              value={
                // Intentamos buscar fullTimeEmployees o employees
                formatLargeNumber((profile as unknown as {fullTimeEmployees?: number; employees?: number}).fullTimeEmployees ?? (profile as unknown as {fullTimeEmployees?: number; employees?: number}).employees)
              }
            />
            <CompanyInfoItem
              icon={<Globe className="w-4 h-4" />}
              label="País"
              value={profile.country ?? ''}
            />
            <CompanyInfoItem
              icon={<ExternalLink className="w-4 h-4" />}
              label="Sitio Web"
              value={
                profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate block max-w-full"
                  >
                    {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                ) : (
                  ''
                )
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}