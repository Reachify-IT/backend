import axios from 'axios';

const processEmailService = async ({
    client_name,
    client_company,
    client_designation,
    client_mail,
    client_website,
    video_path
}) => {

    console.log(client_name, client_company, client_designation, client_mail, client_website, video_path);

    try {
        console.log('AI Processing email...');
        const response = await axios.post('http://api.reachifyinnovations.in/api/process-email', {
            "my_company": "Reachify Innovations",
            "my_designation": "CTO",
            "my_name": "Abhinav Dogra",
            "my_mail": "info@reachifyinnovations.com",
            "my_work": "Software development and website optimization",
            "my_cta_link": "https://www.reachifyinnovations.com/contactus",
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
        }
        );


        console.log('Email processed successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error processing email:', error.response?.data || error.message);
        throw error;
    }
};

export default processEmailService;