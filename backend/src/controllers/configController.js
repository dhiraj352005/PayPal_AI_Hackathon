import { getSystemStatus, updateCredentials } from '../services/configService.js';
import { updateCredentialsSchema } from '../validators/schemas.js';

export async function getHealthHandler(req, res, next) {
  try {
    const status = await getSystemStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
}

export async function updateCredentialsHandler(req, res, next) {
  try {
    const validated = updateCredentialsSchema.parse(req.body);
    const result = await updateCredentials(validated);
    res.json(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid credential payload',
        errors: error.errors.map(e => e.message)
      });
    }
    if (error.message.includes('Unauthorized')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    res.status(400).json({ success: false, message: error.message });
  }
}
