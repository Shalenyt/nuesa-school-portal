import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { toast } from '@/hooks/use-toast';

export default function StudentViewMaterials() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      if (!userId) {
        setMaterials([]);
        setLoading(false);
        return;
      }

      // Get user profile to check department and level
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('department_id, level_id')
        .eq('id', userId)
        .single();

      if (!profile?.department_id || !profile?.level_id) {
        setMaterials([]);
        setLoading(false);
        return;
      }

      // Get courses from course lists based on student's department and level
      const { data: courseListData, error: courseListError } = await (supabase as any)
        .from('course_lists')
        .select('course_ids')
        .eq('class_id', profile.level_id)
        .eq('subject_id', profile.department_id)
        .maybeSingle();

      console.log('Materials - Course list data:', courseListData, 'Error:', courseListError);
      console.log('Materials - Profile data:', profile);

      if (!courseListData?.course_ids || courseListData.course_ids.length === 0) {
        setMaterials([]);
        setLoading(false);
        return;
      }

      // Get materials for those courses
      console.log('Fetching materials for course IDs:', courseListData.course_ids);
      const { data: materialsData, error: materialsError } = await (supabase as any)
        .from('materials')
        .select(`
          *,
          courses(subjects(name))
        `)
        .in('course_id', courseListData.course_ids);

      console.log('Materials query result:', materialsData, 'Error:', materialsError);

      const allMaterials = materialsData?.map((material: any) => ({
        ...material,
        courseName: material.courses?.subjects?.name
      })) || [];

      setMaterials(allMaterials);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({
        title: "Error",
        description: "Failed to fetch materials.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadMaterial = (fileUrl: string, fileName: string) => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.click();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Materials</h1>
          <p className="text-muted-foreground">
            Access materials from your enrolled courses
          </p>
        </div>

        {loading ? (
          <div className="text-center">Loading materials...</div>
        ) : materials.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No materials available</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please update your department and level in your profile, or no materials have been uploaded yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {materials.map((material) => (
              <Card key={material.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {material.title}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4 inline mr-1" />
                    {material.courseName}
                  </div>
                </CardHeader>
                <CardContent>
                  {material.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {material.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {material.file_name}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => downloadMaterial(material.file_url, material.file_name)}
                      disabled={!material.file_url}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}