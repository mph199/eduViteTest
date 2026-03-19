import express from 'express';
import crudRoutes from './teachers/crud.js';
import csvImportRoutes from './teachers/csvImport.js';
import slotsRoutes from './teachers/slots.js';
import loginRoutes from './teachers/login.js';

const router = express.Router();

router.use(crudRoutes);
router.use(csvImportRoutes);
router.use(slotsRoutes);
router.use(loginRoutes);

export default router;
