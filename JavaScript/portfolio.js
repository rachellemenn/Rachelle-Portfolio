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

    this.DrawPie = function (data) {
        // Convert data to a list of pairs name, value
        var items = mapToNameValue(data);

        if (items === null || items.length === 0) {
            console.log("Nothing to draw");
            return;
        }

        var colors = [
            "#00e0ff", "#0f57e2", "#0000ff", "#000086",
        ];
        radius = Math.min(width, height) / 2;

        var arc = d3.arc()
            .outerRadius(radius - 10)
            .innerRadius(5)
            .padAngle(0.09);

        var pie = d3.pie().value(function (d) {
            return d.value
        });

        var arcs = pie(items);

        console.log('creating paths');

        var svg = clearSvgContainer();
        var g = svg.selectAll("path")
            .data(arcs)
            .enter()
            .append("path").attr("d", arc)
            .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")")
            .attr("fill", function (d, i) {
                return colors[i];
            });
    }

    this.Viz4 = function (data) {
        var first = data.columns[0];
        var second = data.columns[1];
        var third = data.columns[2];

        console.log("data", data);

        var fullSets = [
            { sets: [first], size: 0 },                 // 0 - first
            { sets: [second], size: 0 },                // 1 - second
            { sets: [third], size: 0 },                 // 2 - third
            { sets: [first, second], size: 0 },         // 3 - first, second
            { sets: [first, third], size: 0 },          // 4 - first, third
            { sets: [second, third], size: 0 },         // 5 - second, third
            { sets: [first, second, third], size: 0 }]; // 6 -- all three

        // Process data and update sets. The data in the CSV is as follows:
        //    First three columns have ones if the value is associated with sets.
        //  Update sets size for each row
        data.forEach(function (d) {
            if (d[first] === 1) {
                fullSets[0].size += d.Value;        // Set with first set
                if (d[second] === 1) {
                    fullSets[3].size += d.Value;         // Set with first and second set
                    if (d[third] === 1) {
                        fullSets[6].size += d.Value;     // Set with first, second, and third set
                    }
                }
                else if (d[third] === 1) {
                    fullSets[4].size += d.Value;         // Set with first and third set
                }
            }
            if (d[second] === 1) {
                fullSets[1].size += d.Value;             // Set with second set
                if (d[third] === 1) {
                    fullSets[5].size += d.Value;         // Set with second and third
                }
            }
            if (d[third] === 1) {
                fullSets[2].size += d.Value;             // Set with third set
            }
        });

        var z = d3.scaleOrdinal()
            .range([
                "#00e0ff", "#0f57e2", "#0000ff", "#000086",
            ]);
        var colorMap = {};
        var colorIndex = 0;

        var colors = function(key) {
            if (key in colorMap) {
                return colorMap[key];
            }
            var ret = colorMap[key] = z(colorIndex);
            colorIndex += 1;
            return ret;
        };
        // Get the parent
        var svg = clearSvgContainer();

        var chart = venn.VennDiagram().colours(colors);
        svg.datum(fullSets).call(chart);
    }

    this.Viz6 = function (data) {
        data.forEach(function (d) {
            d.Value = parseFloat(d.Value);
        });

        var x0 = d3.scaleBand()
            .rangeRound([0, width])
            .paddingInner(0.1);
        var x1 = d3.scaleBand()
            .padding(0.05);

        var y = d3.scaleLinear()
            .rangeRound([height, 0]);
        var y1 = d3.scaleBand()

        var z = d3.scaleOrdinal()
            .range(["#00e0ff", "#000086",]);

        var stack = d3.stack()
            .offset(d3.stackOffsetExpand);

        x0.domain(data.map(function (d) {
            return d.Identity;
        }));
        x1.domain(data.map(function (d) {
            return d.Imp;
        }))
            .rangeRound([0, x0.bandwidth()])
            .padding(0.2);

        z.domain(data.map(function (d) {
            return d.Religion;
        }));

        var keys = z.domain()

        var groupData = d3.nest()
            .key(function (d) {
                return d.Imp + d.Identity;
            })
            .rollup(function (d, i) {
                var d2 = {
                    Imp: d[0].Imp,
                    Identity: d[0].Identity
                }
                d.forEach(function (d) {
                    d2[d.Religion] = d.Value
                })
                return d2;
            })
            .entries(data)
            .map(function (d) {
                return d.value;
            });

        var stackData = stack
            .keys(keys)(groupData)

        var graphHeight = d3.max(data, function (d) {
            return d.Value;
        });

        y.domain([0, graphHeight]).nice();

        // Get the parent
        var svg = clearSvgContainer();
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var serie = g.selectAll(".serie")
            .data(stackData)
            .enter().append("g")
            .attr("class", "serie")
            .attr("fill", function (d) {
                return z(d.key);
            });

        serie.selectAll("rect")
            .data(function (d) {
                return d;
            })
            .enter().append("rect")
            .attr("class", "serie-rect")
            .attr("transform", function (d) {
                return "translate(" + x0(d.data.Identity) + ",0)";
            })
            .attr("x", function (d) {
                return x1(d.data.Imp);
            })
            .attr("y", function (d) {
                return 1 - d[0];
            })
            .attr("height", function (d) {
                return y(d[0]) - y(d[1]);
            })
            .attr("width", x1.bandwidth());

        g.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x0));

        g.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(null, "s"))
            .append("text")
            .attr("x", 2)
            .attr("y", y(y.ticks().pop()) + 0.5)
            .attr("dy", "0.32em")
            .attr("fill", "#000")
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .text("Population");

        var legend = serie.append("g")
            .attr("class", "legend")
            .attr("transform", function (d) {
                var d = d[d.length - 1];
                return "translate(" + (x0(d.data.Identity) + x1(d.data.Imp) + x1.bandwidth()) + "," + ((y(d[0]) + y(d[1])) / 2) + ")";
            });

        legend.append("line")
            .attr("x1", -6)
            .attr("x2", 6)
            .attr("stroke", "#000");

        legend.append("text")
            .attr("x", 9)
            .attr("dy", "0.35em")
            .attr("fill", "#000")
            .style("font", "10px sans-serif")
            .text(function (d) {
                return d.key;
            });
    }

    this.Viz7 = function (data) {


        var tau = 2 * Math.PI; // http://tauday.com/tau-manifesto

        // An arc function with all values bound except the endAngle. So, to compute an
        // SVG path string for a given angle, we pass an object with an endAngle
        // property to the `arc` function, and it will return the corresponding string.
        var arc = d3.arc()
            .innerRadius(180)
            .outerRadius(240)
            .startAngle(0);

        // Get the SVG container, and apply a transform such that the origin is the
        // center of the canvas. This way, we don’t need to position arcs individually.

        container.selectAll("*").remove();
        var svg = d3.select("svg"),
            g = svg.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
        // var svg = clearSvgContainer(),
        //     height = +svg.attr("height"),
        //     g = svg.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");



        // Add the background arc, from 0 to 100% (tau).
        var background = g.append("path")
            .datum({
                endAngle: tau
            })
            .style("fill", "#ddd")
            .attr("d", arc);

        // Add the foreground arc in orange, currently showing 12.7%.
        var foreground = g.append("path")
            .datum({
                endAngle: 0 * tau
            })
            .style("fill", "#0000ff")
            .attr("d", arc);
        //Rachelle's comment: changed the colors, the sizings.Removed math.random from the function below and replaced
        //with the number 0.6962. This was preiviously in the above var. That now says 0. this way, the viz starts 
        //unfilled and then fills to the appropriate percentage. idk why it just does

        // Every so often, start a transition to a new random angle. The attrTween
        // definition is encapsulated in a separate function (a closure) below.
        //Rachelle's comment: this is redrawing itself over and over, figure out how to stick it
        d3.interval(function () {
            foreground.transition()
                .duration(100)
                .attrTween("d", arcTween(data[0].Value * tau));
        }, 1500);

        // Returns a tween for a transition’s "d" attribute, transitioning any selected
        // arcs from their current angle to the specified new angle.
        function arcTween(newAngle) {

            // The function passed to attrTween is invoked for each selected element when
            // the transition starts, and for each element returns the interpolator to use
            // over the course of transition. This function is thus responsible for
            // determining the starting angle of the transition (which is pulled from the
            // element’s bound datum, d.endAngle), and the ending angle (simply the
            // newAngle argument to the enclosing function).
            return function (d) {

                // To interpolate between the two angles, we use the default d3.interpolate.
                // (Internally, this maps to d3.interpolateNumber, since both of the
                // arguments to d3.interpolate are numbers.) The returned function takes a
                // single argument t and returns a number between the starting angle and the
                // ending angle. When t = 0, it returns d.endAngle; when t = 1, it returns
                // newAngle; and for 0 < t < 1 it returns an angle in-between.
                var interpolate = d3.interpolate(d.endAngle, newAngle);

                // The return value of the attrTween is also a function: the function that
                // we want to run for each tick of the transition. Because we used
                // attrTween("d"), the return value of this last function will be set to the
                // "d" attribute at every tick. (It’s also possible to use transition.tween
                // to run arbitrary code for every tick, say if you want to set multiple
                // attributes from a single function.) The argument t ranges from 0, at the
                // start of the transition, to 1, at the end.
                return function (t) {

                    // Calculate the current arc angle based on the transition time, t. Since
                    // the t for the transition and the t for the interpolate both range from
                    // 0 to 1, we can pass t directly to the interpolator.
                    //
                    // Note that the interpolated angle is written into the element’s bound
                    // data object! This is important: it means that if the transition were
                    // interrupted, the data bound to the element would still be consistent
                    // with its appearance. Whenever we start a new arc transition, the
                    // correct starting angle can be inferred from the data.
                    d.endAngle = interpolate(t);

                    // Lastly, compute the arc path given the updated data! In effect, this
                    // transition uses data-space interpolation: the data is interpolated
                    // (that is, the end angle) rather than the path string itself.
                    // Interpolating the angles in polar coordinates, rather than the raw path
                    // string, produces valid intermediate arcs during the transition.
                    return arc(d);
                };
            };
        }

    }

    this.Viz8 = function (data) {
        // Nested data, rearange it. Column 0 is the key
        //
        var ndata = d3.nest()
            .key(function (d) {
                return d[data.columns[0]]
            })
            .entries(data);

        console.log(ndata);


        // Define the margin, radius. If radius is r and margin is
        // m, the width is devided into the given number of charts (n).
        // Each chart is 2 * (m + r). Therefore:
        //   width = n * 2 * (m + r)
        // Since r is 10 * m, the result is:
        //   width = n * 22 * m
        var m = Math.floor(width / (22 * ndata.length));
        var r = 10 * m;

        console.log("m: ", m, "r: ", r);

        // Define the color scale. The color scale will be
        // assigned by index, but if you define your data using objects, you could pass
        // in a named field from the data object instead, such as `d.name`. Colors
        // are assigned lazily, so if you want deterministic behavior, define a domain
        // for the color scale.
        z = d3.scaleOrdinal()
            .range([
                "#00e0ff", "#0f57e2", "#0000ff", "#000086",
            ]);

        // Define the pie layout. Column 2 (the third column) is the value.
        var pie = d3.pie().value((d) => {
            return d[data.columns[2]];
        });

        // Insert an svg element (with margin) for each row in our dataset. A child g
        // element translates the origin to the pie center.
        var svg = clearSvgContainer();
        container.selectAll("*").remove();
        var gx = container.selectAll('svg').data(ndata)
            .enter().append('svg')
            .attr("width", width /*(r + m) * 2*/)
            .attr("height", height /*(r + m) * 2*/)
            .append('g')
            .attr("transform", function (d, i) {
                var offset = 2 * i * (r + m);
                return "translate(" + (r + m + offset) + "," + (r + m) + ")";
            });

        // Label the chart
        gx.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(function (d) {
                return d.key;
            });

        // Define an arc generator.
        var arc = d3.arc()
            .innerRadius(r / 2)
            .outerRadius(r)
            .padAngle(0.09);

        // Create paths for each chart
        console.log('creating paths');
        var g = gx.selectAll("g")
            .data(function (d) {
                return d3.pie().value(function (d) {
                    return d[data.columns[2]];
                })(d.values);
            })
            .enter().append("g");

        // Fill the arc
        console.log('filling arcs');
        g.append("path").attr("d", arc)
            .style("fill", function (d, i) {
                return z(i);
            });
    }

    this.DrawDonutsMultiple = function (data) {
        // Nested data, rearange it. Column 0 is the key
        //
        var ndata = d3.nest()
            .key(function (d) {
                return d[data.columns[0]]
            })
            .entries(data);

        // The charts are going to be placed into a (hopefully) square
        // table.
        var horSize = ndata.length;
        var vertSize = 1;

        // For any number > 2, compute the table size
        if (horSize > 2) {
            horSize = Math.round(Math.sqrt(horSize));
            vertSize = (ndata.length + horSize - 1) / horSize;
        }

        // Define the margin, radius. If radius is r and margin is
        // m, the width is devided into the given number of charts (n).
        // Each chart is 2 * (m + r). Therefore:
        //   width = n * 2 * (m + r)
        // Since r is 10 * m, the result is:
        //   width = n * 22 * m
        var m = Math.floor((width - margin.top - margin.bottom) / (22 * horSize));
        var r = 10 * m;

        // Define the color scale. The color scale will be
        // assigned by index, but if you define your data using objects, you could pass
        // in a named field from the data object instead, such as `d.name`. Colors
        // are assigned lazily, so if you want deterministic behavior, define a domain
        // for the color scale.
        z = d3.scaleOrdinal()
            .range([
                "#00e0ff", "#0f57e2", "#0000ff", "#000086",
            ]);

        // Define the pie layout. Column 2 (the third column) is the value.
        var pie = d3.pie().value((d) => {
            return d.Value;
        });

        // Define an arc generator.
        var arc = d3.arc()
            .innerRadius(r / 2)
            .outerRadius(r)
            .padAngle(0.09);

        var svg = clearSvgContainer();
        var i;
        for (i = 0; i < ndata.length; i++) {
            // Compute arcs generation 
            var arcs = pie(ndata[i].values);

            // Compute xOffset
            var verOffset = 2 * (r + m) * Math.floor(i / horSize);
            var horOffset = 2 * (r + m) * Math.floor(i % horSize);

            var transform = "translate(" + (r + m + horOffset) + "," + (r + m + verOffset) + ")"

            // Create and shift a surface for the circle
            var g = svg.append("g")
                .attr("transform", transform);

            // Insert corresponding paths for the donut
            g.selectAll("path")
                .data(arcs)
                .enter().append('path')
                .attr("d", arc)
                .style("fill", function (p, i) {
                    return z(i);
                });

            // Add text to the surface
            g.append("text")
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(ndata[i].key);
        }
    }

    this.Viz10 = function (data) {
        data.forEach(function (d) {
            d.Value = parseFloat(d.Value);
        });

        var x = d3.scaleBand()
            .rangeRound([0, width])
            .paddingInner(0.1)
            .padding(0.05);

        var x1 = d3.scaleBand()
            .padding(0.05);

        var y = d3.scaleLinear()
            .rangeRound([height, 0]);

        var y1 = d3.scaleBand()

        var z = d3.scaleOrdinal()
            .range(["#00e0ff", "#000086"]);

        var stack = d3.stack()
            .offset(d3.stackOffsetExpand);

        x.domain(data.map(function (d) { return d.National; }));
        x1.domain(data.map(function (d) { return d.Religious; }))
            .rangeRound([0, x.bandwidth()])
            .padding(0.2);

        z.domain(data.map(function (d) { return d.Religious; }))
        var keys = z.domain()

        var groupData = d3.nest()
            .key(function (d) { return d.Religious; })
            .entries(data);

        var stackData = stack
            .keys(keys)(groupData)

        //   console.log("stackData", stackData)


        y.domain([0, 100]).nice();

        console.log("keys", keys)

        var svg = clearSvgContainer();
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var serie = g.selectAll(".serie")
            .data(groupData)
            .enter().append("g")
            .attr("class", "serie")
            .attr("fill", function (d) { return z(d.key); });


        serie.selectAll("rect")
            .data(function (d) { console.log("rect: ", d.values); return d.values; })
            .enter().append("rect")
            .attr("class", "serie-rect")
            .attr("transform", function (d) { return "translate(" + x(d.National) + ",0)"; })
            .attr("x", function (d) { return x1(d.Religious); })
            .attr("y", function (d) { return y(100 - 100 * d.Value); })
            .attr("height", function (d) { return y(100 * d.Value); })
            .attr("width", x1.bandwidth())
            .on("click", function (d, i) { console.log("serie-rect click d", i, d); });

        g.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));

        g.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(null, "s"))
            .append("text")
            .attr("x", 2)
            .attr("y", y(y.ticks().pop()) + 0.5)
            .attr("dy", "0.32em")
            .attr("fill", "#000")
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .text(" % Population");

        var legend = serie.append("g")
            .attr("class", "legend")
            .attr("transform", function (d) { var d = d[d.length - 1]; return "translate(" + (x(d.data.Identity)) + "," + ((y(d[0]) + y(d[1])) / 2) + ")"; });

        legend.append("line")
            .attr("x1", -6)
            .attr("x2", 6)
            .attr("stroke", "#000");

        legend.append("text")
            .attr("x", 9)
            .attr("dy", "0.35em")
            .attr("fill", "#000")
            .style("font", "10px sans-serif")
            .text(function (d) { return d.key; });
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
        new Loader("Assets/Data/Title.txt", this.LoadMainTitle),
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