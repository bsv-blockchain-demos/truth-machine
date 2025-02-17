export default (address, balance) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Timestamp Microservice</title>
    <style>
        body {
            font-family: Helvetica, sans-serif;
            margin: 2rem;
        }
    </style>
</head>
<body>
    <h1>Data Timestamper</h1>
    <h2>Upload</h2>
    <p>Send data to /upload endpoint to store and timestamp on the BSV Blockchain.</p>
    <h2>Download</h2>
    <p>Retrieve stored data from /download/{hash} along with an integrity proof and timestamp.</p>
    <h2>Funding Service</h2>
    <p>This service has ${balance} write tokens remaining. To top up the balance, 
    make a BSV payment to ${address} and hit the <a href="/fund/10">/fund/{number}</a> endpoint.</p>
</body>
</html>
`   