import { createClient } from '@supabase/supabase-js';

// These will come from your Supabase Dashboard -> Settings -> API
const supabaseUrl = 'https://pkmyrwowyrffwhkxecil.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbXlyd293eXJmZndoa3hlY2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzAxOTIsImV4cCI6MjA4NDUwNjE5Mn0.ngcj7kgrP7wlD7IvF3hO5Ttk59vn-LZKGWDAkOj1--M';

export const supabase = createClient(supabaseUrl, supabaseKey);