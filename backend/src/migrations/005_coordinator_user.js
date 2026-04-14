const bcrypt = require('bcryptjs');

exports.up = (db) => {
  console.log('[Migrate] Seeding coordinator user...');
  
  const insertUser = db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
  
  // Check if coordinator already exists to prevent unique constraint error
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get('coordinator');
  
  if (!exists) {
    const hashedPassword = bcrypt.hashSync('coordinator123', 10);
    insertUser.run('coordinator', hashedPassword, 'Administrative Coordinator', 'coordinator');
    console.log('- [Migrate] Coordinator user created.');
  } else {
    console.log('- [Migrate] Coordinator user already exists.');
  }
};
