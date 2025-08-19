import Appointment from '../models/Appointment.js';
import validator from 'validator';

export const getAppointments = async (req, res) => {
  try {
    const { status, date } = req.query;
    let filter = {};

    if (status) {
      filter.status = status;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      filter.appointmentDate = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const appointments = await Appointment.find(filter)
      .sort({ appointmentDate: 1 })
      .limit(50);

    res.json({
      success: true,
      appointments
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      appointment
    });

  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment'
    });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findByIdAndDelete(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete appointment'
    });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const { name, email, phone, appointmentDate, appointmentTime, purpose } = req.body;

    // Validation
    if (!name || !email || !phone || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    if (!validator.isMobilePhone(phone, 'any', { strictMode: false })) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    const appointment = new Appointment({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      purpose: purpose || 'General consultation',
      conversationId: `manual_${Date.now()}`
    });

    await appointment.save();

    res.status(201).json({
      success: true,
      appointment
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create appointment'
    });
  }
};