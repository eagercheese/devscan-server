require('dotenv').config();
const app = require('./app');
const sequelize = require('./models');
const PORT = process.env.PORT || 3000;

sequelize.authenticate()
  .then(() => {
    console.log('MySQL connection established successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the MySQL database:', err);
    process.exit(1);
  });
