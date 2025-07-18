-- Insert sample data for testing

-- Insert schools if they don't exist
INSERT INTO schools (name, domain)
SELECT 'White Oaks Secondary School', 'hdsb.ca'
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE name = 'White Oaks Secondary School');

-- Insert subjects if they don't exist
-- Using individual INSERT statements to avoid DO block syntax issues
INSERT INTO subjects (name, category, grade_level)
SELECT 'Calculus', 'Mathematics', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'Calculus' 
    AND category = 'Mathematics' 
    AND grade_level = 'High School'
);

INSERT INTO subjects (name, category, grade_level)
SELECT 'Advanced Functions', 'Mathematics', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'Advanced Functions' 
    AND category = 'Mathematics' 
    AND grade_level = 'High School'
);

INSERT INTO subjects (name, category, grade_level)
SELECT 'Biology', 'Science', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'Biology' 
    AND category = 'Science' 
    AND grade_level = 'High School'
);

INSERT INTO subjects (name, category, grade_level)
SELECT 'Chemistry', 'Science', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'Chemistry' 
    AND category = 'Science' 
    AND grade_level = 'High School'
);

INSERT INTO subjects (name, category, grade_level)
SELECT 'Physics', 'Science', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'Physics' 
    AND category = 'Science' 
    AND grade_level = 'High School'
);

INSERT INTO subjects (name, category, grade_level)
SELECT 'English', 'Language Arts', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'English' 
    AND category = 'Language Arts' 
    AND grade_level = 'High School'
);

INSERT INTO subjects (name, category, grade_level)
SELECT 'Computer Science', 'Technology', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'Computer Science' 
    AND category = 'Technology' 
    AND grade_level = 'High School'
);

INSERT INTO subjects (name, category, grade_level)
SELECT 'French', 'Foreign Language', 'High School'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects 
    WHERE name = 'French' 
    AND category = 'Foreign Language' 
    AND grade_level = 'High School'
);