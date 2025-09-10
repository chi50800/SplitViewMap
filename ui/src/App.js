import React from "react";
import SplitMap from "./SplitMap";

function App() {
    return (
        <div style={{ padding: "20px" }}>
            <h1>EO/SAR Split-View Map</h1>
            <p>
                Upload two GeoTIFFs below. The left panel shows Image A, the right panel
                shows Image B.
            </p>
            <SplitMap />
        </div>
    );
}

export default App;
