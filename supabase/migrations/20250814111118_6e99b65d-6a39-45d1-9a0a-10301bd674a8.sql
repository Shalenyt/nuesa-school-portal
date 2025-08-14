-- Create the net schema first
CREATE SCHEMA IF NOT EXISTS net;

-- Enable the http extension for HTTP requests  
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA net;