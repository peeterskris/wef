var gBiggestFirst = true; //should largest circles be added first?
var gxScale, grScale, gcolorScale;
var gDefaultHeight = 400;
var gLabelMargin = 150;
var gWidth = 700;
var gBubbleHeight = 70;
var gInitialPosition = gBubbleHeight;
var gMaxRadius = 18;
var gCurrentView = "global";
var gCurrentYear = 2014;
var gReferenceYear = 2014;
var gData = [];
var gAllData = [];
var gRegions = d3.map();
var gIncomegroups = d3.map();
var gCountriesByRegion = {};
var gGlobal = d3.map({"Global": 0});
var gCountryList = {};
var getMetricList = {};

window.onload=function(){
    queue()
        .defer(JSZipUtils.getBinaryContent, "data/gitr2014_web.csv.zip")
        .defer(d3.csv, "data/population.csv")
        .defer(d3.csv, "data/countries.csv")
        .await(ready);
}

function ready(error, gitr, population, countries) {
    var zip = new JSZip(gitr);
    gitr = zip.file("gitr2014_web.csv").asText();
    gitr = d3.csv.parse(gitr);
    data = merge(gitr,population, countries);
    gAllData = gData;

    gData = buildBubbleArray(data.metrics["NRI"]);
    sortRegionsAndIncomegroups();
    showVisualisation(gData, true);

    loadButtons(data);
}

function loadButtons(data){
    $("#toggles ." + gCurrentView).addClass("active");
    $("#years ." + gCurrentYear).addClass("active");
    d3.selectAll("#toggles button[data-view]")
      .datum(function(d) { return this.getAttribute("data-view"); })
      .on("click", transitionView);



    d3.selectAll("#years button[data-view]")
          .datum(function(d) { return this.getAttribute("data-view"); })
          .on("click", transitionYear);

    gCountryList = $('#countries').magicSuggest({
            allowFreeEntries: false,
            data: getCountryList(),
            valueField: 'code',
            displayField: 'name',
            placeholder: 'Search countries',
            maxSelection: null
        });

    $(gCountryList).on('selectionchange', function(e,m){
      highlightCountries(this.getValue());
    });


    for(metric in data.metrics){
        var text = data.metrics[metric].label;
        if(text.indexOf("A.") == 0 || text.indexOf("B.") == 0 || text.indexOf("C.") == 0 || text.indexOf("D.") == 0) continue; //text = "-- " + text;
        if(text.indexOf("Pillar") == 0) text = "&nbsp;&nbsp;" + text;
        else if(text.indexOf("Networked Readiness Index") == 0)  text = text;
        else text = "&nbsp;&nbsp;&nbsp;&nbsp;" + text;
        $('#metrics ul').prepend('<li role="presentation"><a role="menuitem" tabindex="-1" data-view=' + metric + '>' + text + '</a></li>');

        if(data.metrics[metric].label.indexOf("Pillar") == 0)
            $('#metrics ul').prepend('<li role="presentation" class="divider"></li>');
    }

    d3.selectAll("#metrics ul a[data-view]")
          .datum(function(d) { return this.getAttribute("data-view"); })
          .on("click", transitionMetric);
}

function getMetricList(data){
    for(metric in data){

    }
}

function getCountryList(){
    var countries = [];
    gData.forEach(function(country){
        countries.push({"code": country.code, "name": country.name});
    });
    countries = countries.sort(function(a,b){return a.name > b.name;});
    return countries;
}

function loadCountries(){
    var countries = [];
    gCountriesByRegion.forEach(function (region){
        region.values.forEach(function(country){
            countries.push(country);
        })
    });
    countries = countries.sort(function(a,b) { return a.name > b.name });
    countries.forEach(function(country){
        $("#countries").append('<option value="'+country.code+'">' + country.name + '</option>');
    });
}

//function
function highlightCountries(countries){
    d3.selectAll("#bubbles circle").classed("focussed", false);
    if(countries.length == 0)
        d3.select("#bubbles").classed("highlight", false);
    else{
        d3.select("#bubbles").classed("highlight", true);
        countries.forEach(function(code){
            d3.selectAll("#bubbles circle." + code).classed("focussed", true);
        });
    }
}

function selectCountry(country){
    var item = {"code": country.code, "name": country.name};
    var list = gCountryList.getValue();
    var index = list.indexOf(country.code);
    if(index == -1)
        gCountryList.addToSelection(item);
    else
        gCountryList.removeFromSelection(item);

}

function merge(gitr, pop, countriesInfo) {
    var countries = {};
    var metrics = {};

    pop.forEach(function(item){
        var code = item.Country_Code;
        countries[code] = {"code": code, "name": item.Country_Name, "population": item.Population};
    });

    countriesInfo.forEach(function(item){
        var code = item.Country_Code;
        countries[code]["region"] = item.Region;
        countries[code]["incomegroup"] = item.IncomeGroup;

    })

    gitr.forEach(function(item){
        var code = item.Entity_code;
        var year = item.Edition;
        var metric = item.GLOBAL_ID;

        if(!(metric in metrics)){
            metrics[metric] = {"id": metric, "label": item.Series_with_units, "years" : {}}
        }
        if(!(year in metrics[metric]["years"])){
            metrics[metric]["years"][year] = []
        }

        element = {
            "id": metric,
            "value": item.Value,
            "rank": item.Rank,
            "country": countries[code],
            "label": item.Series_with_units
        }
        metrics[metric]["years"][year].push(element);
    });

    return {"countries": countries, "metrics": metrics};
}

function showVisualisation(data, build){
    var svg = d3.select("svg");//.style("height", gDefaultHeight);

    if(build){
        var labels = svg.append("g")
            .attr("id", "labels")
            .attr("transform", "translate(0," + gInitialPosition + ")")
        var axes = svg.append("g")
            .attr("id", "axes")
            .attr("transform", "translate(" + gLabelMargin + "," + gInitialPosition + ")")

        var bubbleLine = svg.append("g")
            .attr("id", "bubbles")
            .attr("transform", "translate(" + gLabelMargin + "," + gInitialPosition + ")")
        var legend = svg.append("g")
            .attr("id", "legend");
            //.attr("transform", "translate(" + gLabelMargin + "," + (gInitialPosition+gBubbleHeight) + ")");
    }

    showLabels(labels);
    showLines(axes);
    showBubbles(data, bubbleLine);
   // showLegend(legend);
}

function sortRegionsAndIncomegroups(){
     var regions = d3.nest()
          .key(function(d) { return d.region; })
          .entries(gData)
          .sort(sortByX);

    var incomegroups = d3.nest()
        .key(function(d) { return d.incomegroup; })
        .entries(gData)
        .sort(sortByX);

    regions.forEach(function(level, index){
        gRegions.set(level.key,index);
    });

    incomegroups.forEach(function(level, index){
        gIncomegroups.set(level.key,index);
    });

    gCountriesByRegion = regions;
}

function sortByX(a,b){
    var aSum = 0, bSum = 0;
    a.values.forEach(function(d){aSum+=d[gCurrentYear].x;});
    b.values.forEach(function(d){bSum+=d[gCurrentYear].x;});
    return bSum / b.values.length - aSum / a.values.length ;
}

function buildScales(metric){

    var maxX = Number.MIN_VALUE, minX = Number.MAX_VALUE;
    for(year in metric.years){
        var series = metric.years[year];
        maxX = Math.max(maxX, d3.max(series, function(d) { return parseFloat(d.value); }));
        minX = Math.min(minX, d3.min(series, function(d) { return parseFloat(d.value); }));
    }
    var series =  metric.years[gReferenceYear];
//    var maxX = d3.max(nri, function(d) { return parseFloat(d.value); });
//    var minX = d3.min(nri, function(d) { return parseFloat(d.value); });
    var maxR = d3.max(series, function(d) { return parseInt(d.country.population); });
    var marginX = (maxX-minX)*0.1;


    var xScale = d3.scale.linear()
        .domain([minX,maxX+marginX])
        .range([0,gWidth]);

    var rScale = d3.scale.sqrt()
        //make radius proportional to square root of data r
        .domain([1,maxR])
        .range([1,gMaxRadius]);

    var colorScale = d3.scale.linear()
        .domain([minX, (maxX+minX)/2, maxX])
        .range(["#d73027", "#ffffbf", "#1a9850"]);

    gxScale = xScale;
    grScale = rScale;
    gcolorScale = colorScale;
}

function buildBubbleArray(data){
    buildScales(data);
    var metric = data;
    var result = d3.map();

    for(year in metric.years){
        result = buildBubbles(metric.years[year], result, year);
    }
    return result.values();
}

function buildBubbles(data,result, year){
    data = data.sort(
        gBiggestFirst?
            function(a,b){return b.country.population - a.country.population;} :
            function(a,b){return a.country.population - b.country.population;}
        )
    var maxX = d3.max(data, function(d) { return parseFloat(d.value); });
    var minX = d3.min(data, function(d) { return parseFloat(d.value); });
    var quadtree = d3.geom.quadtree()
            .x(function(d) { return gxScale(d.x); })
            .y(0)
            .extent([[gxScale(-1),0],[gxScale(maxX)*1.2,0]]);

    var padding = 2; //space in pixels between circles
    var quadroot = quadtree([]);
    var regionquadroots = {};
    var incomegroupquadroots = {};
    var bubbles = [];
    data.forEach(function(item){
        var value = parseFloat(item.value)
        var region = item.country.region;
        var incomegroup = item.country.incomegroup;
        if(!(region in regionquadroots)) regionquadroots[region] = quadtree([]);
        if(!(incomegroup in incomegroupquadroots)) incomegroupquadroots[incomegroup] = quadtree([]);

        if(isNaN(value)) value = Math.min(minX *2, -1000);

        var d = {
            "x": value,
            "r": parseInt(item.country.population),
            "cx": gxScale(value)
        };
        var region_d = { "x": value, "r": parseInt(item.country.population) };
        var incomegroup_d = { "x": value, "r": parseInt(item.country.population)};

        d["cy"] = calculateOffset(0, quadroot, gxScale, grScale, padding)(d);
        d["region_cy"] = calculateOffset(0, regionquadroots[region], gxScale, grScale, padding)(region_d);
        d["incomegroup_cy"] = calculateOffset(0, incomegroupquadroots[incomegroup], gxScale, grScale, padding)(incomegroup_d);

        quadroot.add(d);
        regionquadroots[region].add(region_d);
        incomegroupquadroots[incomegroup].add(incomegroup_d);


        if(!result.has(item.country.code)){
            result.set(item.country.code, item.country);
        }
        var element = result.get(item.country.code);
        element[year] = d;
        element["metric"] = item.label;
    });
    return result;
}

function showLines(axes){
    var nrRegions = gRegions.keys().length;
    var nrIncomeGroups = gIncomegroups.keys().length;
    var nrLines = Math.max(nrRegions, nrRegions);

    for(var i =0;i<nrLines;i++){
        var classes = "axis";
        classes += i<nrRegions? " region" : "";
        classes += i<nrIncomeGroups? " incomegroup" : "";
        classes += i==0? " global" : ""
        axes.append("line")
            .style("opacity", i==0?1:0)
            .attr("x1", gxScale.range()[0])
            .attr("x2", gxScale.range()[1])
            .attr("y1", gBubbleHeight*i)
            .attr("y2", gBubbleHeight*i)
            .attr("class", classes)
            //.attr("class", i<nrRegions ? "region ":"" + i<nrIncomeGroups ? "incomegroup ":"" + i==0?"global":"");
    }
}

function showLabels(labels){
    transitionLabels(labels, "global", false);
}

function transitionLabels(labels, view, delay){
    var data = [];
    switch(view) {
        case "region":
            data = gRegions.keys();
            break;
        case "incomegroup":
            data = gIncomegroups.keys();
            break;
        default:
            data = gGlobal.keys();
    }

    labels = labels
        .selectAll("text")
        .data(data, function(d) { return d; })

    labels.exit().transition().duration(500).style("opacity", 0).remove();

    labels.enter()
        .append("text")
        .attr("y", function(d,i){ return gBubbleHeight*i; })
        .text(function(d) {return d;})
        .style("opacity", 0)
        .transition()
        .delay(delay?500:0)
        .duration(500)
        .style("opacity", 1);
}

function showLegend(legend, view){

    var height = getSvgHeight(view);
    legend = legend.attr("transform", "translate(" + gLabelMargin + "," + height + ")");

    legend.append("text")
        //.attr("x", 0)
        .style("text-anchor", "end")
        .style("font", "bold 9px sans-serif")
        .text("LEGEND");

    var gColor = g.append("g")
          .attr("class", "key-color")
          .attr("transform", "translate(140,-7)");

      gColor.selectAll("rect")
          .data(gcolorScale.range().map(function(d, i) {
            return {
              x0: i ? x(z.domain()[i - 1]) : x.range()[0],
              x1: i < 4 ? x(z.domain()[i]) : x.range()[1],
              z: d
            };
          }))
        .enter().append("rect")
          .attr("height", 8)
          .attr("x", function(d) { return d.x0; })
          .attr("width", function(d) { return d.x1 - d.x0; })
          .style("fill", function(d) { return d.z; });
}

function transitionLegend(legend, view){
    var duration = 1000;
    var currentHeight = getSvgHeight(gCurrentView);
    var height = getSvgHeight(view);
    var heightDuration = height < currentHeight ? duration *2 : duration;
//    legend =
        legend
          .transition()
          .duration(heightDuration)
          .attr("transform", "translate(" + gLabelMargin + "," + height + ")");
}

function transitionLines(axes, view){

    axes.selectAll(".axis").transition().duration(500)
        .style("opacity", 0);
    axes.selectAll("." + view).transition().delay(500).duration(1000)
        .style("opacity", 1);
}

function getNrBubbleCharts(view){
    switch(view) {
    case "region":
        return gRegions.keys().length;
        break;
    case "incomegroup":
        return gIncomegroups.keys().length;
        break;
    default:
        return 1;
    }
}
function showBubbles(data, bubbleLine){

    //D3 program to fit circles of different sizes along a
    //horizontal dimension, shifting them up and down
    //vertically only as much as is necessary to make
    //them all fit without overlap.
    //By Amelia Bellamy-Royds, in response to
    //http://stackoverflow.com/questions/20912081/d3-js-circle-packing-along-a-line
    //inspired by
    //http://www.nytimes.com/interactive/2013/05/25/sunday-review/corporate-taxes.html
    //Freely released for any purpose under Creative Commons Attribution licence: http://creativecommons.org/licenses/by/3.0/
    //Author name and link to this page is sufficient attribution.

    maxR = 0;
    var svg = bubbleLine.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("r", function(d){ return grScale(d[gCurrentYear].r);})
        .attr("fill", function(d){ return gcolorScale(d[gCurrentYear].x); })
        .attr("cx", function(d){ return d[gCurrentYear].cx; })
        .attr("cy", function(d){ return d[gCurrentYear].cy; })
        .attr("class", function(d){ return d.code })
        .on("click", selectCountry);

        $('svg circle').tipsy({
            gravity: function(){
                var x = this.cx.baseVal.value;
                var y = this.cy.baseVal.value;
                var value = 'n';
                //if(y > 0)        value += 's'; else value += 'n'; // for now, always do n, looks better
                if(x < gWidth/2)  value += 'w'; else value += 'e';

                return value;
            },
            html: true,
            title: function() {
              var d = this.__data__, c = gcolorScale(parseFloat(d[gCurrentYear].x));
              var population = d3.format(",");
              return '<div class="tipsyinfo">'
                   + '  <div class="tipsyrow noborder"><div class="tipsylabel">Country</div><div class="value">' + d.name + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Population</div><div class="value">' + population(d.population)  + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Region</div><div class="value">' + d.region  + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Income group</div><div class="value">' + d.incomegroup  + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Value</div><div class="value">' + d[gCurrentYear].x + '</div></div>'
                   + '</div>'
            }
        })
}

function transitionMetric(metric, highlight){
//    $("#chart").empty();
//    d3.select("#labels").remove();
//    d3.select("#axes").remove();
//    d3.select("#legend").remove();
    //

    //d3.select("#chart").transition().duration(500).style("opacity", 0).text('');
    $("#chart-title").text(data.metrics[metric].label);

    console.log(metric);
    gData = buildBubbleArray(data.metrics[metric]);

    transitionCircles(gCurrentView, gCurrentYear, 1000, true);
   // sortRegionsAndIncomegroups();
   // transitionLabels(svg.select("#labels"), gCurrentView, false);

    showVisualisation(gData, false);
    highlightCountries(gCountryList.getValue());
}

function transitionYear(year){
    if(year == gCurrentYear)
        return;
    $("#years ." + gCurrentYear).removeClass("active");
    $("#years ." + year).addClass("active");

    var svg = d3.select("svg");
    var duration = 1000;
    transitionCircles(gCurrentView, year, duration,true);
    gCurrentYear = year;
}

function transitionView(view){
    if(view == gCurrentView)
        return;

    $("#toggles ." + gCurrentView).removeClass("active");
    $("#toggles ." + view).addClass("active");

    var svg = d3.select("svg");
    var duration = 1000;
//    var currentHeight = getSvgHeight(gCurrentView);
//    var height = getSvgHeight(view);
//    var heightDuration = height < currentHeight ? duration *2 : duration;
//       svg
//          .transition()
//          .duration(heightDuration)
//          .style("height", height + "px");

    transitionLines(svg.select("#axes"), view);
    transitionLabels(svg.select("#labels"), view, true);
    transitionCircles(view, gCurrentYear, duration, true);
   // transitionLegend(svg.select("#legend"), view);
    gCurrentView = view;
}

function transitionCircles(view, year, duration, delay){
    var svg = d3.select("svg");
    circles = svg.selectAll("circle")
        .data(gData)
        .transition()
        .duration(duration)
        //.delay(function(d){ return delay?(d[year].x-2)*200:0})
        .delay(function(d){ return delay?gxScale(d[year].x):0})
        .attr("cx", function(d){return d[year].cx })
        .attr("fill", function(d){ return gcolorScale(d[year].x); });

    if(view == "region"){
        circles
            .attr("cy", function(d){
                var axisIndex = gRegions.get(d.region);
                var axisPos = (axisIndex+1)*gBubbleHeight - gInitialPosition;
                return axisPos + d[year].region_cy;
         });
    }
    else if(view == "incomegroup"){
        circles
            .attr("cy", function(d){ return (gIncomegroups.get(d.incomegroup)+1)*(gBubbleHeight) - gInitialPosition + d[year].incomegroup_cy });
    }
    else if(view == "global"){
        circles
            .attr("cy", function(d){return d[year].cy });
    }
}

function getSvgHeight(view){
    var nr = getNrBubbleCharts(view);
    return (nr+1)*gBubbleHeight;
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};









// Find the all nodes in the tree that overlap a given circle.
// quadroot is the root node of the tree, scaledX and scaledR
//are the position and dimensions of the circle on screen
//maxR is the (scaled) maximum radius of dots that have
//already been positioned.
//This will be most efficient if you add the circles
//starting with the smallest.
function findNeighbours(root, scaledX, scaledR, maxR, padding, xScale, rScale) {

    var neighbours = [];
    //console.log("Neighbours of " + scaledX + ", radius " + scaledR);

  root.visit(function(node, x1, y1, x2, y2) {
      //console.log("visiting (" + x1 + "," +x2+")");
    var p = node.point;
    if (p) { //this node stores a data point value
        var overlap, x2=xScale(p.x), r2=rScale(p.r);
        if (x2 < scaledX) {
            //the point is to the left of x
            overlap = (x2+r2 + padding >= scaledX-scaledR);
            /*console.log("left:" + x2 + ", radius " + r2 + (overlap?" overlap": " clear"));//*/
        }
        else {
            //the point is to the right
            overlap = (scaledX + scaledR + padding >= x2-r2);
            /*console.log("right:" + x2 + ", radius " + r2 + (overlap?" overlap": " clear"));//*/
        }
        if (overlap) neighbours.push(p);
    }

    return (x1-maxR > scaledX + scaledR + padding)
            && (x2+maxR < scaledX - scaledR - padding) ;
      //Returns true if none of the points in this
      //section of the tree can overlap the point being
      //compared; a true return value tells the `visit()` method
      //not to bother searching the child sections of this tree
  });

  return neighbours;
}

function calculateOffset(maxR, quadroot, xScale, rScale, padding){
    return function(d) {
        neighbours = findNeighbours(quadroot,
                                   xScale(d.x),
                                   rScale(d.r),
                                   maxR, padding, xScale, rScale);
        var n=neighbours.length;
        //console.log(j + " neighbours");
        var upperEnd = 0, lowerEnd = 0;

        if (n){
            //for every circle in the neighbour array
            // calculate how much farther above
            //or below this one has to be to not overlap;
            //keep track of the max values

            var zeroPosValid = true;

            var j=n, occupied=new Array(n);
            while (j--) {
                var p = neighbours[j];
                var hypoteneuse = rScale(d.r)+rScale(p.r)+padding;
                //length of line between center points, if only
                // "padding" space in between circles

                var base = xScale(d.x) - xScale(p.x);
                // horizontal offset between centres

                var vertical = Math.sqrt(Math.pow(hypoteneuse,2) - Math.pow(base, 2));
                //Pythagorean theorem

                occupied[j]=[p.offset+vertical,p.offset-vertical];
                //max and min of the zone occupied
                //by this circle at x=xScale(d.x)

                var xAxisDistance = Math.sqrt(Math.pow(base,2)+Math.pow(p.offset,2));
                if(xAxisDistance <= hypoteneuse){
                    zeroPosValid = false;
                }
            }
            if(zeroPosValid){
                //console.log('x axis is fine for ' + d.name + ' ' + d.r);
                //return d.offset = 0;
            }

            occupied = occupied.sort(
                function(a,b){
                    //return a[0] - b[0];
                    return a[0] - b[0];
                });
            //sort by the max value of the occupied block
            //console.log(occupied);
            lowerEnd = upperEnd = 1/0;//infinity

            j=n;
            while (j--){
                //working from the end of the "occupied" array,
                //i.e. the circle with highest positive blocking
                //value:

                if (lowerEnd > occupied[j][0]) {
                    //then there is space beyond this neighbour
                    //inside of all previous compared neighbours
                    upperEnd = Math.min(lowerEnd, occupied[j][0]);
                    lowerEnd = occupied[j][1];
                }
                else {
                    lowerEnd = Math.min(lowerEnd, occupied[j][1]);
                }
            //console.log("at " + formatPercent(d.x) + ": "
              // + upperEnd + "," + lowerEnd);
            }
        }

            //assign this circle the offset that is smaller
            //in magnitude:
        return d.offset =
                (Math.abs(upperEnd)<Math.abs(lowerEnd))?
                        upperEnd : lowerEnd;
    };
}


