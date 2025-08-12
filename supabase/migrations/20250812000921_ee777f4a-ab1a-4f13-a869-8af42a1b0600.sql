-- Add description column to courses table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='description') THEN
        ALTER TABLE public.courses ADD COLUMN description text;
    END IF;
END $$;

-- Add name column to courses table if it doesn't exist  
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='name') THEN
        ALTER TABLE public.courses ADD COLUMN name text;
    END IF;
END $$;