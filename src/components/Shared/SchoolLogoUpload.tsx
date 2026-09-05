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
      const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED.includes(ext)) {
        throw new Error('Invalid image type. Allowed: JPG, PNG, WEBP, SVG');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image too large. Maximum size is 5MB.');
      }

      // Unique filename so CDN/browser caches can never serve the old logo.
      const filePath = `logos/school-logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(filePath, file, { upsert: true, cacheControl: '3600', contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('school-assets')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Persist to the database (create the settings row if it does not exist yet)
      const { data: existingSettings, error: fetchError } = await (supabase as any)
        .from('school_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingSettings) {
        const { error: updateError } = await (supabase as any)
          .from('school_settings')
          .update({ logo_url: publicUrl })
          .eq('id', existingSettings.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await (supabase as any)
          .from('school_settings')
          .insert({ school_name: 'NUESA PORTAL', logo_url: publicUrl, singleton: true });
        if (insertError) throw insertError;
      }

      onLogoUpdated(publicUrl);

      toast({
        title: "School logo updated",
        description: "The new logo is saved and will stay after refresh.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      event.target.value = '';
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