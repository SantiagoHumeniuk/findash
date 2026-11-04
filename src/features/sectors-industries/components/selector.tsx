// src/features/sectors-industries/components/selector.tsx

import React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../../components/ui/select';
import { Loader2, Search } from 'lucide-react';

/**
 * Props for the Selector component.
 */
interface SelectorProps {
  /**
   * Label text for the selector
   */
  label: string;
  
  /**
   * Placeholder text when no option is selected
   */
  placeholder: string;
  
  /**
   * Array of option strings to display
   */
  options: string[];
  
  /**
   * Currently selected value
   */
  value: string | null;
  
  /**
   * Callback when selection changes
   */
  onChange: (value: string) => void;
  
  /**
   * Whether data is loading
   */
  isLoading?: boolean;
}

/**
 * Reusable selector component for industries and sectors.
 * 
 * @example
 * ```tsx
 * <Selector
 *   label="Seleccionar Industria"
 *   placeholder="Elegí una industria..."
 *   options={industries.map(i => i.industry)}
 *   value={selectedIndustry}
 *   onChange={setSelectedIndustry}
 *   isLoading={isLoading}
 * />
 * ```
 */
export const Selector: React.FC<SelectorProps> = ({
  label,
  placeholder,
  options,
  value,
  onChange,
  isLoading = false
}) => {
  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="selector" className="text-base font-semibold">{label}</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="w-3 h-3" />
              <span>{options.length} disponibles</span>
            </div>
          </div>
          <Select
            value={value ?? undefined}
            onValueChange={onChange}
            disabled={isLoading || options.length === 0}
          >
            <SelectTrigger id="selector" className="h-12 text-base border-primary/20 hover:border-primary/40 transition-colors">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                options.map((option) => (
                  <SelectItem key={option} value={option} className="cursor-pointer">
                    {option}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
