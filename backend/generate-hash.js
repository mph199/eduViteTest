import bcrypt from 'bcryptjs';

const password = 'bksb2024';
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nCopy this hash to auth.js ADMIN_USER.passwordHash');
