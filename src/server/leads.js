const express = require('express');
const router = express.Router();
const axios = require('axios');

// BatchData API configuration
const BATCHDATA_API_TOKEN = process.env.BATCHDATA_API_TOKEN;
const BATCHDATA_API_URL = 'https://api.batchdata.com/api/v1/property/search';

// Test BatchData API connection
router.get('/test', async (req, res) => {
    try {
        console.log('=== Testing BatchData API Connection ===');
        console.log('API Token:', BATCHDATA_API_TOKEN ? 'Present' : 'Missing');
        console.log('API URL:', BATCHDATA_API_URL);

        // Simple test query matching the new API format
        const testQuery = {
            searchCriteria: {
                query: "Phoenix, AZ",
                compAddress: {
                    city: "phoenix",
                    state: "AZ"
                }
            },
            options: {
                useYearBuilt: true,
                skip: 0,
                take: 1
            }
        };

        console.log('Test query:', JSON.stringify(testQuery, null, 2));

        try {
            // Test POST request with new format
            const response = await axios({
                method: 'post',
                url: BATCHDATA_API_URL,
                headers: {
                    'Authorization': `Bearer ${BATCHDATA_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, application/xml'
                },
                data: testQuery,
                validateStatus: false,
                timeout: 5000
            });
            
            const results = {
                status: response.status,
                data: response.data
            };

            console.log('Test Results:', JSON.stringify(results, null, 2));

            res.json({
                success: response.status === 200,
                message: 'Testing BatchData API',
                results
            });
        } catch (error) {
            console.error('Test Error:', {
                error: error.message,
                response: error.response?.data
            });

            res.json({
                success: false,
                error: error.message,
                details: error.response?.data
            });
        }
    } catch (error) {
        console.error('BatchData API Test Error:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            error: 'BatchData API Test Failed',
            message: error.message,
            details: error.response?.data || error.stack
        });
    }
});

// Get leads with optional filtering
router.get('/', async (req, res) => {
    try {
        console.log('=== Processing Lead Search Request ===');
        console.log('Query parameters:', req.query);
        const { state, city, zip, street, query } = req.query;

        if (!BATCHDATA_API_TOKEN || BATCHDATA_API_TOKEN === 'your_batchdata_api_token') {
            console.error('BatchData API token not properly configured');
            throw new Error('BatchData API token not properly configured. Please set BATCHDATA_API_TOKEN in .env file.');
        }
        
        // Build BatchData API query with new format
        const searchData = {
            searchCriteria: {
                query: query || (city && state ? `${city}, ${state}` : undefined),
                compAddress: {}
            },
            options: {
                useYearBuilt: true,
                skip: 0,
                take: 10
            }
        };
        
        // Add address components if provided
        if (street) searchData.searchCriteria.compAddress.street = street;
        if (city) searchData.searchCriteria.compAddress.city = city;
        if (state) searchData.searchCriteria.compAddress.state = state.toUpperCase();
        if (zip) searchData.searchCriteria.compAddress.zip = zip;
        
        // Remove empty compAddress if no components were added
        if (Object.keys(searchData.searchCriteria.compAddress).length === 0) {
            // If no specific address components and no query, we can't proceed
            if (!searchData.searchCriteria.query) {
                throw new Error('Search requires either a query parameter or location details (city, state, etc.)');
            }
        }

        console.log('Sending request to BatchData API:', {
            url: BATCHDATA_API_URL,
            data: JSON.stringify(searchData, null, 2)
        });

        // Call BatchData API with POST and new format
        const response = await axios({
            method: 'post',
            url: BATCHDATA_API_URL,
            headers: {
                'Authorization': `Bearer ${BATCHDATA_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json, application/xml'
            },
            data: searchData,
            validateStatus: false
        });

        console.log('BatchData API response:', {
            status: response.status,
            statusText: response.statusText,
            data: response.data // Log the response data for debugging
        });

        // Handle non-200 responses explicitly
        if (response.status !== 200) {
            throw new Error(`BatchData API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }

        // Adjust property mapping based on the actual response format
        // This may need to be updated based on the actual response structure
        const leads = response.data?.properties || [];
        console.log(`Found ${leads.length} leads`);
        
        const formattedLeads = leads.map(property => ({
            street_address: property.address || property.street || '',
            city: property.city || '',
            state: property.state || '',
            zip: property.zip || '',
            owner_full_name: property.owner_name || property.ownerName || '',
            owner_mailing_street: property.mailing_address || property.mailingAddress || '',
            owner_mailing_city: property.mailing_city || property.mailingCity || '',
            owner_mailing_state: property.mailing_state || property.mailingState || '',
            owner_mailing_zip: property.mailing_zip || property.mailingZip || ''
        }));

        res.json({
            leads: formattedLeads,
            metadata: {
                total: response.data?.total || leads.length,
                page: Math.floor(searchData.options.skip / searchData.options.take) + 1,
                limit: searchData.options.take
            }
        });
    } catch (error) {
        console.error('Error processing lead search request:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });

        // Provide more specific error messages based on the error type
        let errorMessage = 'Failed to fetch leads from BatchData';
        let statusCode = 500;

        if (error.response?.status === 401) {
            errorMessage = 'Invalid BatchData API token. Please check your configuration.';
            statusCode = 401;
        } else if (error.response?.status === 404) {
            errorMessage = 'BatchData API endpoint not found. Please check the API URL.';
            statusCode = 404;
        } else if (error.response?.status === 429) {
            errorMessage = 'BatchData API rate limit exceeded. Please try again later.';
            statusCode = 429;
        }

        res.status(statusCode).json({
            error: 'BatchData API Error',
            message: errorMessage,
            details: error.response?.data?.message || error.message
        });
    }
});

module.exports = router; 