import express from 'express';
import { 
  getAppointments, 
  updateAppointmentStatus, 
  deleteAppointment, 
  createAppointment 
} from '../controllers/appointmentController.js';

const router = express.Router();

// Get appointments
router.get('/', getAppointments);

// Create appointment
router.post('/', createAppointment);

// Update appointment status
router.patch('/:appointmentId/status', updateAppointmentStatus);

// Delete appointment
router.delete('/:appointmentId', deleteAppointment);

export default router;