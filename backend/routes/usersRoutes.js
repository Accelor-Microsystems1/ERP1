const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const rolesController = require('../controllers/rolescontroller');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
// User routes
router.get('/', usersController.getUsers);
// router.post('/users', usersController.createUser);
// router.put('/:id', usersController.updateUser);

// START CHANGE
router.post('/create-user', upload.single('signature'), usersController.createUser);
router.put('/:id', upload.single('signature'), usersController.updateUser);
// END CHANGE


// Role routes
router.get('/roles', rolesController.getRoles);
router.post('/roles', rolesController.createRole);
router.put('/roles/:id/permissions', rolesController.updatePermissions);

module.exports = router;