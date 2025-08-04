const { adminDB } = require('../database');

const createService = async (req, res) => {
    try {
      const { service } = req.body;
  
      if (!service || typeof service !== 'object') {
        return res.badRequest({
          success: false,
          message: 'Missing or invalid service data'
        });
      }
  
      const result = await adminDB().collection('services').insertOne(service);
  
      const responseData = {
        success: true,
        message: 'Service created successfully',
        service: {
          _id: result.insertedId,
          ...service,
        }
      };
  
      res.success(responseData);
    } catch (error) {
      console.error('Create Service Error:', error);
      res.internalServerError({ success: false, message: 'Something went wrong while creating the service' });
    }
  };
  
const getAllServices = async (req, res) => {
  try {
    const services = await adminDB().collection('services').find({}).toArray();
    res.success({ services });
  } catch (error) {
    console.error('Get All Services Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while fetching services' });
  }
};

const getService = async (req, res) => {
  try {
    const { name } = req.params;

    const service = await adminDB().collection('services').findOne({ name });

    if (!service) {
      return res.notFound({ success: false, message: 'Service not found' });
    }

    res.success({ service });
  } catch (error) {
    console.error('Get Service Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while fetching the service' });
  }
};

const updateService = async (req, res) => {
  try {
    const { name } = req.params;
    const { service } = req.body;

    if (!service || !service.name) {
      return res.badRequest({ success: false, message: 'Invalid service data' });
    }

    const result = await adminDB().collection('services').updateOne(
      { name },
      { $set: service }
    );

    if (result.matchedCount === 0) {
      return res.notFound({ success: false, message: 'Service not found' });
    }

    res.success({ success: true, message: 'Service updated successfully' });
  } catch (error) {
    console.error('Update Service Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while updating the service' });
  }
};

const deleteService = async (req, res) => {
  try {
    const { name } = req.params;

    const result = await adminDB().collection('services').deleteOne({ name });

    if (result.deletedCount === 0) {
      return res.notFound({ success: false, message: 'Service not found' });
    }

    res.success({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete Service Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while deleting the service' });
  }
};

module.exports = {
  createService,
  getAllServices,
  getService,
  updateService,
  deleteService
};
