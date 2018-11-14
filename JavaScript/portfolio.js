function SetupTooltips()
{
    var tooltips = document.querySelectorAll('[data-keyword]');
    var dict = {};

    tooltips.forEach(function(tooltip) {
        var key = tooltip.getAttribute('data-keyword');
        if (key !== null)
        {
            dict[key] = tooltip.innerHTML;
        }
    });

    tooltips = document.querySelectorAll('[data-tooltip]');

    tooltips.forEach(function(tooltip) {
        var key = tooltip.getAttribute('data-tooltip');
        // See if we have it in the map
        var value = dict[key];

        // If not, make up value
        if (value === null)
        {
            value = "TODO";
        }

        // Now add the tooltip and class
        tooltip.classList.add('keyword');
        var popup = document.createElement('div');
        popup.classList.add('tooltip');
        popup.innerHTML = value;
        tooltip.appendChild(popup);
    });
}

// Simple class that loads a CSV file and 
// optionally calls a callback function
function Loader(fileName, callbackFunction, context) {
    // Privates
    var fileName = fileName;
    var data = null;
    var CallbackFunction = callbackFunction;
    var loaded = false;
    var busy = false;
    var failed = false;
    var Loader = SimpleCSVLoader;
    var callbackContext = context;


    // Private functions
    var SimpleCSVLoader = (callback) => {
        busy = true;
        console.log("SimpleCSVLoader " + fileName);
        d3.csv(fileName, (error, rows) => {
            if (error) {
                failed = true;
                console.log("Failed to read " + fileName);
            } else {
                console.log(rows);
                rows.forEach((row) => {
                    // Go through properties and convert strings to numbers
                    for (var prop in row) {
                        if (row.hasOwnProperty(prop)) {
                            var str = row[prop];
                            var value = parseInt(str);
                            if (!isNaN(value)) {
                                value = parseFloat(str);
                                if (!isNaN(value)) {
                                    row[prop] = value;
                                }
                            }
                        }
                    }
                });

                // Clearly we completed the load, check the flag
                loaded = true;
                data = rows;
                console.log(data);
            }

            busy = false;
            console.log("Finished reading the file, callback");
            callback();
        });
    }

    // Public functions
    this.IsLoaded = () => {
        return loaded;
    }

    this.IsBusy = () => {
        return busy;
    }

    this.IsFailed = () => {
        return failed;
    }

    this.FileName = () => {
        return fileName;
    }

    this.CallbackContext = () => {
        return callbackContext;
    }

    this.Activate = (callback) => {
        console.log("Activating for file " + fileName);
        if (!failed) {
            if (!loaded && !busy) {
                // Load, no data yet
                SimpleCSVLoader(callback);
            } else if (loaded) {
                // Callback (draw)
                CallbackFunction(data);
            }
        } else {
            callback();
        }
    };

}


// A class to view vizualizations
function Visualization(fileName) {
    // Privates
    var width = 600;
    var height = 520;
    var margin = {
        top: 40,
        left: 20,
        bottom: 10,
        right: 10
    };

    var container;
    var isNumeric = (val) => Number(parseFloat(val)) === val;

    // Tries to convert data read from CSV into an array of name-value pairs
    var mapToNameValue = (data) => {
        var items = [];
        if (data.length === 1) {
            // This is based on CSV with a single row of data.
            // Here the column name is the pair name for values
            data.columns.forEach((d) => {
                var value = data[0][d];
                // Only convert columns with numeric values
                if (isNumeric(value)) {
                    items.push({
                        name: d,
                        value: value
                    });
                }
            });
        }
        // It's not a single row. We can accept two column data
        else if (data.columns.length === 2) {
            // Look at the first row to see which column is numeric
            var valueColumn;
            var nameColumn;
            if (isNumeric(data[0][data.columns[0]])) {
                valueColumn = 0;
            } else if (isNumeric(data[0][data.columns[1]])) {
                valueColumn = 1;
            } else {
                console.log("The CSV has no numeric column to use a value to chart");
                return null;
            }

            // The other column has the name
            nameColumn = 1 - valueColumn;

            // Convert to pairs
            data.forEach((d) => {
                items.push({
                    name: d[data.columns[nameColumn]],
                    value: d[data.columns[valueColumn]]
                });
            });
        }

        return items;
    }

    // Public functions

    var LoadTitle = function (textToDraw) {
        document.getElementById("svgTitle").innerHTML = "<div class='VizTitle'>" + textToDraw + "</div>";

    }

    this.DrawCircleHierarchy = function (data) {
        // Get the parent
        var g = clearSvgContainer();

        // Initialize layout
        const layout = d3.pack()
            .size([width - 2, height - 2])
            .padding(6)

        // Create hierarchy for our data
        var stratData = d3.stratify()
            .parentId(function (d) {
                return d["parent id"];
            })
            .id(function (d) {
                return d.id;
            });

        // Create hierarchy
        var root = stratData(data);

        // Sort appropriately
        root.sum(function (d) {
            return d.value
        })
            .sort(function (a, b) {
                return b.value - a.value
            });

        var nodes = root.descendants();

        colors = [
            "#000086", "#0000ff", "#0f57e2", "#00e0ff",
        ];
        // official colours ^

        layout(root);

        var slices = g.selectAll('circle')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('cx', function (d) {
                return d.x;
            })
            .attr('cy', function (d) {
                return d.y;
            })
            .attr('r', function (d) {
                return d.r;
            })
            .style("fill", function (d) {
                return colors[d.depth];
            });
    }


    // Private functions

    // Clear the container by selecting all
    // children and removing them. Then add
    // the g child and set the transform
    function clearSvgContainer() {
        container.selectAll("*").remove();
        document.getElementById("svgTitle").innerHTML = "";
        return container.append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");
    }

    this.DrawBar = function (data) {
        // Convert data to a list of pairs name, value
        var items = mapToNameValue(data);

        if (items === null || items.length === 0) {
            console.log("Nothing to draw");
            return;
        }

        // set the ranges
        var x = d3.scaleBand()
            .range([0, width])
            .padding(0.1);
        var y = d3.scaleLinear()
            .range([height, 0]);

        // Get the parent
        var svg = clearSvgContainer();

        // Scale the range of the data in the domains
        x.domain(items.map(function (d) {
            return d.name;
        }));
        y.domain([0, d3.max(items, function (d) {
            return d.value;
        })]);

        // Colors for now
        var colors = [
            "#00e0ff", "#0f57e2", "#0000ff", "#000086",
        ];

        // append the rectangles for the bar chart
        svg.selectAll(".bar")
            .data(items)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", function (d) {
                return x(d.name);
            })
            .attr("width", x.bandwidth())
            .attr("y", (d) => {
                return y(d.value);
            })
            .attr("height", (d) => {
                return height - y(d.value);
            })
            .attr("fill", (d, i) => {
                return colors[i];
            });

        // add the x Axis
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));

        // add the y Axis
        svg.append("g")
            .call(d3.axisLeft(y));

        svg.selectAll(".text")
            .data(items)
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("x", (function (d) { return x(d.name) + x.bandwidth() / 2; }))
            .attr("y", function (d) { return y(d.value) + 1; })
            .attr("dy", ".75em")
            .text(function (d) { return [d.value]; })
            .style("font", "25px Lekton, sans-serif")
            .style("fill", "#ECE8E8")
            // .style("fill")
            .style("margin-top", "60px");
    }

    this.LoadQuotes = function (data) {
        clearSvgContainer();
        document.getElementById("svgTitle").innerHTML = "<div class='quote'>" + data[0].Quote + "</div>";
    }

    this.LoadMainTitle = function (data) {
        clearSvgContainer();
        document.getElementById("svgTitle").innerHTML = "<div class='MainTitle'>" + data[0].Title + "</div>";
    }


    var loaders = [
        /*  0 */
        new Loader("Assets/Content/Title.txt", this.LoadQuotes),
        /*  1 */
        new Loader("Assets/Data/Viz1.csv", this.DrawCircleHierarchy, "Religious Makeup of the USA"),
        /*  2 */
        new Loader("Assets/Data/Quote1.txt", this.LoadQuotes), 
        /*  3 */
        new Loader("Assets/Data/Viz1.csv", this.DrawCircleHierarchy,"Religious Makeup of the USA"),
        /*  4 */
        new Loader("Assets/Data/Viz2final.csv", this.DrawBar, "Geographical Distribution by Region"),
        /*  5 */
        new Loader("Assets/Data/Vizual3.csv", this.DrawPie, "Generational Breakdown of Jewish Americans"),
        /*  6 */
        new Loader("Assets/Data/Quote2.txt", this.LoadQuotes),
        /*  7 */
        new Loader("Assets/Data/Viz4final.csv", this.Viz4, "Components of a Jewish Identity"),
        /*  8 */
        new Loader("Assets/Data/Viz6.csv", this.Viz6, "Components of a Jewish Identity: Specifics"),
        /*  9 */
        new Loader("Assets/Data/Viz7.csv", this.Viz7, "Components of a Jewish Identity: Education"),
        /* 10 */
        new Loader("Assets/Data/Viz6.csv", this.Viz6, "Components of a Jewish Identity"),
        /* 11 */
        new Loader("Assets/Data/Quote3.txt", this.LoadQuotes),
        /* 12 */
        new Loader("Assets/Data/Viz5.csv", this.DrawPie, "Identifying as Jewish By Religion and Jewish Not By Religion"),
        /* 13 */
        new Loader("Assets/Data/Quote4.txt", this.LoadQuotes),
        /* 14 */
        new Loader("Assets/Data/Viz8.csv", this.DrawDonutsMultiple, "Generational Breakdown of Jewish Americans: By Identity"),
        /* 15 */
        null, //new Loader("Assets/Data/Viz9.csv", this.Viz8),
        /* 16 */
        new Loader("Assets/Data/Quote5.txt", this.LoadQuotes),
        /* 17 */
        new Loader("Assets/Data/Viz10.csv", this.DrawDonutsMultiple, "Nationalities of Jewish Americans: By Identity"),
        /* 18 */
        new Loader("Assets/Data/Viz11.csv", this.DrawDonutsMultiple, "Political Ideology of Jewish Americans: By Identity"),
        /* 19 */
        new Loader("Assets/Data/Viz11.1.csv", this.DrawDonutsMultiple, "Political Ideology of Jewish Americans: By Nationality"),
        /* 20 */
        new Loader("Assets/Data/Quote6.txt", this.LoadQuotes),
        /* 21 */
        new Loader("Assets/Data/Viz.12.2.csv", this.DrawDonutsMultiple, "Jewish Americans And Israel: By Nationality"),
        /* 22 */
        new Loader("Assets/Data/Viz.12.3.csv", this.DrawDonutsMultiple, "Jewish Americans And Israel: By Generation"),
        /* 23 */
        new Loader("Assets/Data/Quote7.txt", this.LoadQuotes),
        /* 24 */
        new Loader("Assets/Data/Viz12.1.csv", this.DrawDonutsMultiple, "Jewish Americans and Israel: By Ideology"),
        /* 25 */
        new Loader("Assets/Data/Viz12.csv", this.DrawDonutsMultiple, "Jewish Americans and Israel: By Religion"),
        /* 26 */
        new Loader("Assets/Data/Quote8.txt", this.LoadQuotes),
        /* 27 */
        null,
        /* 28 */
        new Loader("Assets/Data/Vizual13.csv", this.DrawDonutsMultiple, "Secularization of Jewish Traditions: Bar and Bat Mitzvahs"),
        /* 29 */
        new Loader("Assets/Data/Viz13.3.csv", this.DrawDonutsMultiple, "Secularization of Jewish Traditions: Attending Passover Seders"),
        /* 30 */
        new Loader("Assets/Data/Viz13.2.csv", this.DrawDonutsMultiple, "Secularization of Jewish Traditions: Lighting Shabbat Candles"),
        /* 31 */
        new Loader("Assets/Data/Viz13.1.csv", this.DrawDonutsMultiple,"Secularization of Jewish Traditions: Fasting on Yom Kippur"),
        /* 32 */
        new Loader("Assets/Data/Quote9.txt", this.LoadQuotes),
        /* 33 */
        null,
        /* 34 */
        new Loader("Assets/Data/Viz15.csv", this.DrawBar, "Participation in Jewish Organizations: By Identity"),
        /* 35 */
        new Loader("Assets/Data/Quote10.txt", this.LoadQuotes),
        /* 36 */
        new Loader("Assets/Data/Viz15.3.csv", this.DrawBar, "Participation in Jewish Organizations: By Generation"),
        /* 37 */
        new Loader("Assets/Data/Viz15.1.csv", this.DrawPie, "Participation in Jewish Organizations: Jewish Friends"),
        /* 38 */
        new Loader("Assets/Data/Viz15.2.csv", this.Viz7, "Participation in Jewish Organizations: Marriage to a Jew"),
        /* 39 */
        new Loader("Assets/Data/Quote11.txt", this.LoadQuotes),
        /* 40 */
        new Loader("Assets/Data/VIZual14.csv", this.DrawDonutsMultiple, "Marriage: By Generation"),
        /* 41 */
        new Loader("Assets/Data/Vizual14.1.csv", this.DrawDonutsMultiple, "Marriage: By Religion"),
        /* 42 */
        new Loader("Assets/Data/Quote12.txt", this.LoadQuotes),
        /* 43 */
        new Loader("Assets/Data/Viz16.1.csv", this.DrawDonutsMultiple, "Raising Children: Parents' Religion"),
        /* 44 */
        new Loader("Assets/Data/Viz16.csv", this.DrawDonutsMultiple, "Raising Children: Compared Parents' Upbringing"),
        /* 45 */
        new Loader("Assets/Data/Viz4final.csv", this.Viz4),
        /* 46 */
        new Loader("Assets/Data/Quote13.txt", this.LoadQuotes),
    ];

    var lastDrawnIndex = -1;
    var indexToDraw = -1;
    var processing = false;
    var dispatch = d3.dispatch("processChart");
    var scroll;

    // Process one element that needs processing, but only if this function
    // is not processing something at this time
    function Process() {
        // Skip if already processing
        if (!Process.processing) {
            // Mark that we're processing
            Process.processing = true;
            var processItem = null;
            var willDraw = false;
            try {
                // Check if need to redraw something
                if (indexToDraw != -1 && indexToDraw != lastDrawnIndex) {
                    if (loaders[indexToDraw] == null) {
                        SetOpacityAndFixDom([indexToDraw
                            // lastDrawnIndex == -1 ? indexToDraw + 1 : lastDrawnIndex
                        ]);
                        //indexToDraw = lastDrawnIndex;
                    } else {
                        SetOpacityAndFixDom([indexToDraw]);

                        console.log("Activate index " + indexToDraw + " file " + loaders[indexToDraw].FileName() +
                            (loaders[indexToDraw].IsLoaded() ? ", loaded" : ", not loaded") +
                            (loaders[indexToDraw].IsBusy() ? ", busy" : ", not busy") +
                            (loaders[indexToDraw].IsFailed() ? ", failed" : ", not failed"));

                        if (loaders[indexToDraw].IsFailed()) {
                            console.log("Skipping " + indexToDraw + " since it failed");
                        } else if (!loaders[indexToDraw].IsBusy()) {
                            processItem = loaders[indexToDraw];
                            willDraw = processItem.IsLoaded();
                        }
                    }
                }

                // There is nothing to draw. Dispatch a load
                if (processItem == null) {
                    // Look for an item that's not loaded yet
                    loaders.some((l) => {
                        if (l != null && !l.IsLoaded() && !l.IsBusy() && !l.IsFailed()) {
                            processItem = l;
                            return true;
                        }

                        return false;
                    });
                }

                // Process
                if (processItem != null) {
                    processItem.Activate(() => {
                        dispatch.call("processChart", this);
                    });

                    // If processing redrew the item, change the index
                    if (willDraw) {
                        lastDrawnIndex = indexToDraw;
                        if (processItem.CallbackContext() !== undefined) {
                            LoadTitle(processItem.CallbackContext());
                        }
                    }
                }
            } finally {
                Process.processing = false;
            }
        }
    }

    // Set low opacity to non-active sections.
    // Play tricks to make sure the browser
    // knows the extent of each section
    function SetOpacityAndFixDom(indexList) {
        d3.selectAll('.step')
        .style('display', function (d, i) {
            return indexList.indexOf(i) == -1? 'none' : 'block';
        });

    }

    dispatch.on("processChart", function () {
        Process();
    });

    // Start the load
    Process();

    window.onload = () => {
        // HTML is loaded, we can start
        SetOpacityAndFixDom([0]);
        SetupTooltips();

        // Create the container in element that has #vis
        container = d3.select("#svgContainer")
            .append("svg:svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        d3.select('#button1').on('click', () => {
            console.log("Current index " + indexToDraw);
            if (indexToDraw !== loaders.length - 1)
            {
                indexToDraw++;
                console.log("Active on index " + indexToDraw);
            }
            else {
                console.log("indexToDraw: " + indexToDraw + ", loaders.length:" + loaders.length);
            }

            dispatch.call("processChart", this);
        });

        d3.select('#button2').on('click', () => {
            console.log("Current index " + indexToDraw);
            if (indexToDraw > 0)
            {
                indexToDraw--;
                console.log("Active on index " + indexToDraw);
            }
            else {
                console.log("indexToDraw: " + indexToDraw);
            }

            dispatch.call("processChart", this);
        });

        indexToDraw = 0;
        dispatch.call("processChart", this);
        // Above draws the right-hand side
    }
}

var v = new Visualization;