import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Loader2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SchoolLogoUploadProps {
  currentLogoUrl?: string;
  onLogoUpdated: (newUrl: string) => void;
}

export function SchoolLogoUpload({ currentLogoUrl, onLogoUpdated }: SchoolLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `school-logo.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('school-assets')
        .getPublicUrl(filePath);

      // Update school settings - use the first row's ID if it exists
      const { data: existingSettings, error: fetchError } = await (supabase as any)
        .from('school_settings')
        .select('*')
        .limit(1);

      if (fetchError) {
        throw fetchError;
      }

      if (existingSettings && existingSettings.length > 0) {
        const { error: updateError } = await supabase
          .from('school_settings')
          .update({ logo_url: data.publicUrl })
          .eq('id', existingSettings[0].id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('school_settings')
          .insert({ 
            id: crypto.randomUUID(),
            logo_url: data.publicUrl,
            school_name: 'OAUSTECH Portal',
            portal_name: 'OAUSTECH Portal',
            theme_color: '#ef4444'
          });

        if (insertError) {
          throw insertError;
        }
      }

      onLogoUpdated(data.publicUrl);
      
      toast({
        title: "School logo updated",
        description: "The school logo has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="w-32 h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center border-2 border-dashed border-border">
          {currentLogoUrl ? (
            <img 
              src={currentLogoUrl} 
              alt="School Logo" 
              className="w-full h-full object-contain"
            />
          ) : (
            <Building2 className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
      </div>
      
      <div className="relative">
        <Input
          type="file"
          accept="image/*"
          onChange={uploadLogo}
          disabled={uploading}
          className="hidden"
          id="logo-upload"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById('logo-upload')?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? 'Uploading...' : 'Upload School Logo'}
        </Button>
      </div>
    </div>
  );
}