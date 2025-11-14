const axios = require('axios');

// WhatsApp Business API integration
class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  async sendPayslip(phoneNumber, employeeName, payslipBuffer, fileName) {
    try {
      // Validate phone number
      if (!phoneNumber || phoneNumber.trim() === '') {
        throw new Error('Phone number is required');
      }

      // Clean phone number (remove spaces, dashes, etc.)
      let cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Add country code if missing (assuming Kenya +254)
      if (cleanPhone.length === 9 && cleanPhone.startsWith('7')) {
        cleanPhone = '254' + cleanPhone;
      } else if (cleanPhone.length === 10 && cleanPhone.startsWith('07')) {
        cleanPhone = '254' + cleanPhone.substring(1);
      }
      
      // Validate phone number length
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }
      
      console.log(`Sending payslip to ${employeeName} at ${cleanPhone}`);
      
      // Check if WhatsApp API is configured
      if (!this.accessToken || !this.phoneNumberId) {
        console.warn('WhatsApp API not configured, simulating send');
        return {
          success: true,
          messageId: `sim_${Date.now()}`,
          phone: cleanPhone,
          simulated: true
        };
      }
      
      // Upload document first
      const uploadResponse = await this.uploadDocument(payslipBuffer, fileName);
      
      if (!uploadResponse.success) {
        throw new Error('Failed to upload payslip document');
      }

      // Send document message
      const messageData = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'document',
        document: {
          id: uploadResponse.mediaId,
          caption: `Hi ${employeeName}, your payslip for this period is attached. Please keep this for your records. - BSN MANAGER ENTERPRISE`,
          filename: fileName
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        phone: cleanPhone
      };
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        phone: phoneNumber
      };
    }
  }

  async uploadDocument(buffer, fileName) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('messaging_product', 'whatsapp');
      form.append('file', buffer, {
        filename: fileName,
        contentType: 'application/pdf'
      });
      form.append('type', 'application/pdf');

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/media`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            ...form.getHeaders()
          }
        }
      );

      return {
        success: true,
        mediaId: response.data.id
      };
    } catch (error) {
      console.error('WhatsApp upload error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  async sendTextMessage(phoneNumber, message) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      const messageData = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }
}

module.exports = new WhatsAppService();