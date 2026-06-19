const axios = require('axios');

async function run() {
  try {
    const res = await axios.get("http://localhost:4000/api/companies/signed-url", {
      params: { s3Key: "pickups/cmpw65g86005dn1014ozos1k5/07dee5be-ce59-4995-bf59-4823bea41fbc.pdf" },
      // I don't have the token, so I will get 401. But let's see if the endpoint exists!
    });
    console.log("Success", res.data);
  } catch (err) {
    console.error("Error status", err.response ? err.response.status : err.message);
  }
}
run();
