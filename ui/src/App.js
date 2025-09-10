import React from "react";
import SplitMap from "./SplitMap";
import "./App.css";

function App() {
    return (
        <div className="App">
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
