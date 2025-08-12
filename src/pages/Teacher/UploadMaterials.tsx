import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, File, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function UploadMaterials() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    description: '',
    course_id: '',
    material_type: 'document' as 'document' | 'video' | 'presentation' | 'other'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchCourses();
    fetchMaterials();
  }, [profile]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          classes(name),
          subjects(name)
        `)
        .eq('teacher_id', profile?.id);

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select(`
          *,
          courses(name, classes(name), subjects(name))
        `)
        .eq('uploaded_by', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const uploadMaterial = async () => {
    if (!newMaterial.title.trim() || !newMaterial.course_id || !selectedFile) {
      toast({
        title: "Error",
        description: "Please fill in all fields and select a file.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `materials/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create material record
      const { error: insertError } = await supabase
        .from('materials')
        .insert([{
          title: newMaterial.title.trim(),
          description: newMaterial.description.trim(),
          course_id: newMaterial.course_id,
          file_url: filePath,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          uploaded_by: profile?.id
        }]);

      if (insertError) throw insertError;

      toast({
        title: "Material uploaded",
        description: "Your material has been uploaded successfully.",
      });

      setNewMaterial({ title: '', description: '', course_id: '', material_type: 'document' });
      setSelectedFile(null);
      fetchMaterials();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteMaterial = async (id: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage.from('materials').remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Material deleted",
        description: "Material has been removed successfully.",
      });

      fetchMaterials();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Materials</h1>
          <p className="text-muted-foreground">
            Share course materials with your students
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Upload New Material
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Material title"
                value={newMaterial.title}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, title: e.target.value }))}
              />
              <Select
                value={newMaterial.course_id}
                onValueChange={(value) => setNewMaterial(prev => ({ ...prev, course_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} ({course.classes?.name} - {course.subjects?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Material description (optional)"
              value={newMaterial.description}
              onChange={(e) => setNewMaterial(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={newMaterial.material_type}
                onValueChange={(value: any) => setNewMaterial(prev => ({ ...prev, material_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.avi,.mov,.jpg,.jpeg,.png"
              />
            </div>
            <Button onClick={uploadMaterial} disabled={isUploading}>
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload Material'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Uploaded Materials</h2>
          {materials.map((material) => (
            <Card key={material.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <File className="h-5 w-5" />
                      {material.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {material.courses?.name} • {material.material_type.charAt(0).toUpperCase() + material.material_type.slice(1)}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMaterial(material.id, material.file_url)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {material.description && (
                  <p className="text-muted-foreground mb-2">{material.description}</p>
                )}
                <div className="text-sm text-muted-foreground">
                  File: {material.file_name} • Size: {(material.file_size / 1024 / 1024).toFixed(2)} MB
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}