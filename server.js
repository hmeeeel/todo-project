const express = require('express');
const path = require('path');
const fs = require('fs');

const pageRoutes = require('./routes/pageRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();

const PORT = 3000;



app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDirectory = path.join(__dirname, 'uploads');


if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(
    uploadsDirectory,
    { recursive: true }
  );
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/uploads', express.static(uploadsDirectory));


app.use('/', pageRoutes
);

app.use('/', taskRoutes);
app.use((req, res) => { res.status(404).send('Страница не найдена');});


app.listen(
  PORT,
  () => {
    console.log(
      `Server started: http://localhost:${PORT}`
    );
  }
);