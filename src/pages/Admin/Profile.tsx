import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Settings, Camera } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { PhotoUpload } from '@/components/Shared/PhotoUpload';
import { SchoolLogoUpload } from '@/components/Shared/SchoolLogoUpload';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useToast } from '@/hooks/use-toast';
import { useThemeSync } from '@/hooks/useThemeSync';
import { ColorPicker } from '@/components/ui/color-picker';
import { Edit, Palette } from 'lucide-react';

export default function AdminProfile() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const { settings, refetch: refetchSettings } = useSchoolSettings();
  
  // Initialize theme sync
  useThemeSync();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(profile?.profile_photo_url || '');
  
  // School settings state
  const [portalNameEdit, setPortalNameEdit] = useState(false);
  const [portalName, setPortalName] = useState(settings?.portal_name || 'OAUSTECH Portal');
  const [selectedThemeColor, setSelectedThemeColor] = useState(settings?.theme_color || '#ef4444');
  const [hasColorChanged, setHasColorChanged] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: user?.email || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
      setProfilePhotoUrl(profile.profile_photo_url || '');
    }
  }, [profile, user]);

  // Update settings when they change
  useEffect(() => {
    if (settings) {
      setPortalName(settings.portal_name || 'OAUSTECH Portal');
      setSelectedThemeColor(settings.theme_color || '#ef4444');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address
        })
        .eq('id', profile?.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePortalNameToggle = () => {
    if (portalNameEdit) {
      // Save the portal name
      updatePortalName();
    } else {
      setPortalNameEdit(true);
    }
  };

  const updatePortalName = async () => {
    setLoading(true);
    try {
      if (settings?.id) {
        // Update existing settings - ONLY portal name and school name
        const { error } = await (supabase as any)
          .from('school_settings')
          .update({
            portal_name: portalName.trim(),
            school_name: portalName.trim()
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new settings with only portal/school name, preserve defaults for other fields
        const { error } = await (supabase as any)
          .from('school_settings')
          .insert({
            portal_name: portalName.trim(),
            school_name: portalName.trim()
          });

        if (error) throw error;
      }

      toast({
        title: "Portal name updated",
        description: "The portal name has been updated successfully.",
      });
      
      setPortalNameEdit(false);
      await refetchSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleThemeColorChange = (color: string) => {
    setSelectedThemeColor(color);
    setHasColorChanged(color !== settings?.theme_color);
  };

  const updateThemeColor = async () => {
    setLoading(true);
    try {
      if (settings?.id) {
        // Update existing settings - ONLY theme color
        const { error } = await (supabase as any)
          .from('school_settings')
          .update({
            theme_color: selectedThemeColor
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new settings with only theme color
        const { error } = await (supabase as any)
          .from('school_settings')
          .insert({
            theme_color: selectedThemeColor
          });

        if (error) throw error;
      }

      toast({
        title: "Theme color updated",
        description: "The theme color has been updated successfully.",
      });
      
      setHasColorChanged(false);
      await refetchSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Picture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <PhotoUpload 
                  currentPhotoUrl={profilePhotoUrl}
                  onPhotoUpdated={(newUrl) => setProfilePhotoUrl(newUrl)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  School Logo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SchoolLogoUpload 
                  currentLogoUrl={settings?.logo_url}
                  onLogoUpdated={() => refetchSettings()}
                />
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="staff_id">Staff ID</Label>
                      <Input
                        id="staff_id"
                        value={profile?.staff_id || 'Not Set'}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Input
                        id="role"
                        value="Administrator"
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Profile'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Edit className="h-5 w-5" />
                    Rename Portal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="portal_name">Portal Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="portal_name"
                        value={portalName}
                        onChange={(e) => setPortalName(e.target.value)}
                        disabled={!portalNameEdit}
                        className={!portalNameEdit ? "bg-muted" : ""}
                      />
                      <Button
                        onClick={handlePortalNameToggle}
                        variant="outline"
                        disabled={loading}
                      >
                        {portalNameEdit ? 'Rename' : 'Edit'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Theme Color
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Current Theme Color</Label>
                     <div className="flex items-center gap-2">
                       <div
                         className="w-8 h-8 rounded border border-border"
                         style={{ backgroundColor: selectedThemeColor }}
                       />
                       <span className="text-sm text-muted-foreground">
                         {selectedThemeColor}
                       </span>
                     </div>
                  </div>
                  
                   <ColorPicker
                     currentColor={selectedThemeColor}
                     onColorChange={handleThemeColorChange}
                   />
                  
                  <Button
                    onClick={updateThemeColor}
                    disabled={!hasColorChanged || loading}
                    className={`w-full ${!hasColorChanged ? 'opacity-50' : ''}`}
                  >
                    {loading ? 'Updating...' : 'Update Color'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}