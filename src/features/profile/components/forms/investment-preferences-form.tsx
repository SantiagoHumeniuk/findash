// src/features/profile/components/forms/investment-preferences-form.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Label } from "../../../../components/ui/label";
import { Target, Heart } from "lucide-react";
import { InvestmentPreferencesFormProps } from "../../types/profile.types";
import { interestOptions } from "../../lib/profile.utils";

/**
 * Formulario de preferencias de inversión del usuario
 */
export function InvestmentPreferencesForm({
  investorProfile,
  experience,
  interests,
  onInvestorProfileChange,
  onExperienceChange,
  onInterestChange,
}: InvestmentPreferencesFormProps) {
  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          <CardTitle className="text-base sm:text-lg font-semibold">Preferencias de Inversión</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Ayúdanos a personalizar el contenido, alertas y recomendaciones que
          recibes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Selects de perfil y experiencia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-xs sm:text-sm font-medium">Perfil de Inversor</Label>
            <Select
              value={investorProfile || undefined}
              onValueChange={onInvestorProfileChange}
            >
              <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Seleccioná tu perfil..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservador</SelectItem>
                <SelectItem value="moderate">Moderado</SelectItem>
                <SelectItem value="aggressive">Agresivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-xs sm:text-sm font-medium">Nivel de Experiencia</Label>
            <Select value={experience || undefined} onValueChange={onExperienceChange}>
              <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Seleccioná tu experiencia..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Principiante</SelectItem>
                <SelectItem value="intermediate">Intermedio</SelectItem>
                <SelectItem value="advanced">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Áreas de interés */}
        <div className="space-y-2 sm:space-y-3">
          <Label className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Áreas de Interés
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            {interestOptions.map((item) => (
              <div key={item.id} className="flex items-start space-x-3">
                <Checkbox
                  id={item.id}
                  checked={interests[item.id] || false}
                  onCheckedChange={() => onInterestChange(item.id)}
                  className="mt-0.5"
                />
                <label
                  htmlFor={item.id}
                  className="text-xs sm:text-sm font-medium leading-relaxed cursor-pointer text-foreground/90 hover:text-foreground"
                >
                  {item.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
