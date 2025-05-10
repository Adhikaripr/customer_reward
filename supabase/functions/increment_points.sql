-- Create a stored procedure to increment points
CREATE OR REPLACE FUNCTION increment_points(customer_id_param UUID, points_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET total_points = total_points + points_to_add
  WHERE id = customer_id_param;
END;
$$ LANGUAGE plpgsql;
