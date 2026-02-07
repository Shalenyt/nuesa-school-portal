import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface PhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoUpdated: (newUrl: string) => void;
}

export function PhotoUpload({ currentPhotoUrl, onPhotoUpdated }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { profile, refetchProfile } = useAuth();

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !ALLOWED_IMAGE_EXTENSIONS.includes(fileExt)) {
        throw new Error('Invalid image type. Allowed: JPG, PNG, GIF, WEBP');
      }

      if (file.size > MAX_IMAGE_SIZE) {
        throw new Error('Image too large. Maximum size is 5MB.');
      }

      const safeExt = fileExt.replace(/[^a-z0-9]/gi, '');
      const fileName = `${profile?.id}.${safeExt}`;
      const filePath = `${profile?.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: data.publicUrl })
        .eq('id', profile?.id);

      if (updateError) {
        throw updateError;
      }

      onPhotoUpdated(data.publicUrl);
      refetchProfile(); // Refresh profile data to update header avatar
      
      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated successfully.",
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
        <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center">
          {currentPhotoUrl ? (
            <img 
              src={currentPhotoUrl} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
      </div>
      
      <div className="relative">
        <Input
          type="file"
          accept="image/*"
          onChange={uploadPhoto}
          disabled={uploading}
          className="hidden"
          id="photo-upload"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById('photo-upload')?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? 'Uploading...' : 'Change Photo'}
        </Button>
      </div>
    </div>
  );
}