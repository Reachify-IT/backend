const axios = require('axios');
const mongoose = require('mongoose');
const MailInfoSchema = require('../models/MailInfoSchema');

const processEmailService = async ({
    userId,
    client_name,
    client_company,
    client_designation,
    client_mail,
    client_website,
    video_path
}) => {

    console.log(client_name, client_company, client_designation, client_mail, client_website, video_path);
    const objectId = new mongoose.Types.ObjectId(userId);

    const MailInfo = await MailInfoSchema.findOne({ userId: objectId });
    if (!MailInfo) {
        throw new Error('User not found');
    }

    console.log("MailInfo:", MailInfo);

    try {
        console.log('AI Processing email...');
        const response = await axios.post('https://api.loomifyinnovations.com/api/process-email', {
            "my_company": MailInfo.my_company,
            "my_designation": MailInfo.my_designation,
            "my_name": MailInfo.my_name,
            "my_mail": MailInfo.my_mail,
            "my_work": MailInfo.my_work,
            "my_cta_link": MailInfo.my_cta_link,
            client_name,
            client_company,
            client_designation,
            client_mail,
            client_website,
            video_path
        }, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });

        console.log('Email processed successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error processing email:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = processEmailService;
