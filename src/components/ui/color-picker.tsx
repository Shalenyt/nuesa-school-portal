import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  disabled?: boolean;
}

const predefinedColors = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#1f2937', // gray
];

export function ColorPicker({ currentColor, onColorChange, disabled = false }: ColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [customColor, setCustomColor] = useState(currentColor);
  const [open, setOpen] = useState(false);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setCustomColor(color);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    setSelectedColor(color);
  };

  const handleApply = () => {
    onColorChange(selectedColor);
    setOpen(false);
  };

  const handleCancel = () => {
    setSelectedColor(currentColor);
    setCustomColor(currentColor);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-start gap-2"
        >
          <div
            className="w-4 h-4 rounded border border-border"
            style={{ backgroundColor: currentColor }}
          />
          <Palette className="h-4 w-4" />
          Select Color
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Theme Color</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Predefined Colors</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {predefinedColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-10 h-10 rounded border-2 transition-all hover:scale-105 ${
                    selectedColor === color ? 'border-foreground' : 'border-border'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="custom-color">Custom Color</Label>
            <div className="flex gap-2">
              <Input
                id="custom-color"
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="w-16 h-10 p-1"
              />
              <Input
                type="text"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e)}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Color
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}