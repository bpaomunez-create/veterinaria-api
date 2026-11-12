const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());

// --- VALIDACIONES ---
const ESPECIES = ['Perro', 'Gato', 'Conejo', 'Ave', 'Reptil', 'Roedor'];
const PESO_MAX_POR_ESPECIE = {
  Perro: 90, Gato: 15, Conejo: 10, Ave: 3, Reptil: 30, Roedor: 3,
};

function validarMascota(body) {
  const errores = [];
  const { chip, nombre, especie, raza, edad, peso, telefono_dueno, hospitalizado } = body;

  if (!chip || !/^\d{15}$/.test(chip))            errores.push('chip debe tener 15 dígitos');
  if (!nombre || nombre.trim().length < 2)        errores.push('nombre inválido');
  if (!ESPECIES.includes(especie))                errores.push(`especie inválida (${ESPECIES.join(', ')})`);
  if (!raza || raza.trim().length < 2)            errores.push('raza inválida');
  if (!Number.isInteger(edad) || edad < 0 || edad > 60) errores.push('edad debe ser entero entre 0 y 60');
  if (typeof peso !== 'number' || peso <= 0 || peso > 200) errores.push('peso debe ser > 0 y <= 200');
  else if (PESO_MAX_POR_ESPECIE[especie] && peso > PESO_MAX_POR_ESPECIE[especie])
    errores.push(`peso ${peso}kg es imposible para un ${especie}`);
  if (!telefono_dueno || !/^\d{10}$/.test(telefono_dueno)) errores.push('teléfono debe tener 10 dígitos');
  if (hospitalizado !== undefined && typeof hospitalizado !== 'boolean')
    errores.push('hospitalizado debe ser booleano');

  return errores;
}

// --- ENDPOINTS ---

// 1) GET /api/mascotas
app.get('/api/mascotas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM mascotas ORDER BY id');
    res.status(200).json(rows);
  } catch (err) {
    console.log('❌ ERROR EN GET TODAS:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 2) GET /api/mascotas/:id
app.get('/api/mascotas/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query('SELECT * FROM mascotas WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Mascota no encontrada' });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.log('❌ ERROR EN GET POR ID:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 3) POST /api/mascotas
app.post('/api/mascotas', async (req, res) => {
  const errores = validarMascota(req.body);
  if (errores.length) return res.status(400).json({ errores });

  const { chip, nombre, especie, raza, edad, peso, telefono_dueno, hospitalizado = false } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO mascotas (chip, nombre, especie, raza, edad, peso, telefono_dueno, hospitalizado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [chip, nombre, especie, raza, edad, peso, telefono_dueno, hospitalizado]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.log('❌ ERROR EN POST:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: `El chip ${chip} ya está registrado` });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 4) PUT /api/mascotas/:id
app.put('/api/mascotas/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID inválido' });

  const errores = validarMascota(req.body);
  if (errores.length) return res.status(400).json({ errores });

  const { chip, nombre, especie, raza, edad, peso, telefono_dueno, hospitalizado = false } = req.body;

  try {
    const { rowCount, rows } = await pool.query(
      `UPDATE mascotas SET chip = $1, nombre = $2, especie = $3, raza = $4, edad = $5, peso = $6, telefono_dueno = $7, hospitalizado = $8 WHERE id = $9 RETURNING *`,
      [chip, nombre, especie, raza, edad, peso, telefono_dueno, hospitalizado, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Mascota no encontrada' });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.log('❌ ERROR EN PUT:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: `El chip ${chip} ya pertenece a otra mascota` });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 5) DELETE /api/mascotas/:id
app.delete('/api/mascotas/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query('SELECT hospitalizado FROM mascotas WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Mascota no encontrada' });

    if (rows[0].hospitalizado) return res.status(409).json({ error: 'No se puede eliminar una mascota hospitalizada' });

    await pool.query('DELETE FROM mascotas WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.log('❌ ERROR EN DELETE:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = app;