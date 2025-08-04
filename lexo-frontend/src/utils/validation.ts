export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username: string): { valid: boolean; message?: string } {
  const sanitized = sanitizeInput(username);
  
  if (sanitized.length < 3) {
    return { valid: false, message: "Username must be at least 3 characters long" };
  }
  
  if (sanitized.length > 20) {
    return { valid: false, message: "Username cannot exceed 20 characters" };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    return { valid: false, message: "Username can only contain letters, numbers, hyphens, and underscores" };
  }
  
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  
  return { valid: true };
}

export function validateWord(word: string): { valid: boolean; message?: string } {
  const sanitized = sanitizeInput(word);
  
  if (sanitized.length < 3) {
    return { valid: false, message: "Word must be at least 3 characters long" };
  }
  
  if (sanitized.length > 15) {
    return { valid: false, message: "Word cannot exceed 15 characters" };
  }
  
  if (!/^[a-zA-ZçğıöşüÇĞIİÖŞÜ]+$/.test(sanitized)) {
    return { valid: false, message: "Word can only contain letters" };
  }
  
  return { valid: true };
}

export function validateRoomName(name: string): { valid: boolean; message?: string } {
  const sanitized = sanitizeInput(name);
  
  if (sanitized.length < 1) {
    return { valid: false, message: "Room name is required" };
  }
  
  if (sanitized.length > 50) {
    return { valid: false, message: "Room name cannot exceed 50 characters" };
  }
  
  return { valid: true };
}
