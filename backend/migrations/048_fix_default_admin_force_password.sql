-- K2: Default-Admin 'Start' muss beim ersten Login das Passwort aendern
UPDATE users
SET force_password_change = TRUE
WHERE username = 'Start'
  AND role = 'admin'
  AND force_password_change = FALSE;
