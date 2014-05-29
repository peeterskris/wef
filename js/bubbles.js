var gBiggestFirst = true; //should largest circles be added first?
var gxScale, grScale, gcolorScale;
var gDefaultHeight = 400;
var gWidth = 800;
var gBubbleHeight = 70;
var gInitialPosition = gBubbleHeight;
var gMaxRadius = 20;
var gData = [];
var gRegions = {};
var gIncomegroups = {};
var gCurrentView = "global";

window.onload=function(){
    queue()
        .defer(d3.csv, "data/gitr2014_nri.csv")
        .defer(d3.csv, "data/population.csv")
        .defer(d3.csv, "data/countries.csv")
        .await(ready);
}

function ready(error, gitr, population, countries) {
    data = merge(gitr,population, countries);
    gData = buildBubbleArray(data);
    sortRegionsAndIncomegroups();
    showVisualisation(gData);
    d3.selectAll("#toggles button[data-view]")
      .datum(function(d) { return this.getAttribute("data-view"); })
      .on("click", transitionView);
}

function showVisualisation(data){
    var svg = d3.select("svg");//.style("height", gDefaultHeight);

    var axes = svg.append("g")
            .attr("id", "axes")
            .attr("transform", "translate(0," + gInitialPosition + ")")
    var bubbleLine = svg.append("g")
            .attr("id", "bubbles")
            .attr("transform", "translate(0," + gInitialPosition + ")")

    buildLines(axes);
    showBubbles(data,bubbleLine);
}

function sortRegionsAndIncomegroups(){
     var regions = d3.nest()
          .key(function(d) { return d.properties.country.region; })
          .entries(gData)
          .sort(sortByX);

    var incomegroups = d3.nest()
        .key(function(d) { return d.properties.country.incomegroup; })
        .entries(gData)
        .sort(sortByX);

    regions.forEach(function(level, index){
        gRegions[level.key] = index;
    });

    incomegroups.forEach(function(level, index){
        gIncomegroups[level.key] = index;
    });
}

function sortByX(a,b){
    var aSum = 0, bSum = 0;
    a.values.forEach(function(d){aSum+=d.x;});
    b.values.forEach(function(d){bSum+=d.x;});
    return bSum / b.values.length - aSum / a.values.length ;
}
function buildBubbleArray(data){
    var nri =  data.metrics.NRI[2014];
    nri = nri.sort(
        gBiggestFirst?
            function(a,b){return b.country.population - a.country.population;} :
            function(a,b){return a.country.population - b.country.population;}
        )

    var maxX = d3.max(nri, function(d) { return parseFloat(d.value); });
    var minX = d3.min(nri, function(d) { return parseFloat(d.value); });
    var maxR = d3.max(nri, function(d) { return parseInt(d.country.population); });
    var marginX = (maxX-minX)*0.02;
    var padding = 2; //space in pixels between circles

    var xScale = d3.scale.linear()
        .domain([minX-marginX,maxX+marginX])
        .range([0,gWidth]);

    var rScale = d3.scale.sqrt()
        //make radius proportional to square root of data r
        .domain([0,maxR])
        .range([1,gMaxRadius]);

    var colorScale = d3.scale.linear()
        .domain([2, (maxX+2)/2, maxX])
        .range(["#d73027", "#ffffbf", "#1a9850"]);

    gxScale = xScale;
    grScale = rScale;
    gcolorScale = colorScale;

    var quadtree = d3.geom.quadtree()
                .x(function(d) { return xScale(d.x); })
                .y(0)
                .extent([[xScale(-1),0],[xScale(maxX)*1.2,0]]);

  //  nriArray = buildBubbleArrays([{"key": "Overall", "values": nri}], quadtree)[0];
//    gNriPerRegion = buildBubbleArrays(regions, quadtree);
//    gNriPerIncome = buildBubbleArrays(incomes, quadtree);
//    gData = {"overall": nriArray, "region": gNriPerRegion, "income": gNriPerIncome};
    nriArray = buildBubbles(nri, quadtree);
    return nriArray;
}

function buildBubbles(data, quadtree){
    var result = [];
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

        if(!isNaN(value)){
            var d = {
                "x": value,
                "r": parseInt(item.country.population),
                "properties": item,
                "cx": gxScale(value)
            };
            var region_d = { "x": value, "r": parseInt(item.country.population) };
            var incomegroup_d = { "x": value, "r": parseInt(item.country.population)};

            d["cy"] = calculateOffset(0, quadroot, gxScale, grScale, padding)(d);
            d["region_cy"] = calculateOffset(0, regionquadroots[region], gxScale, grScale, padding)(region_d);
            d["incomegroup_cy"] = calculateOffset(0, incomegroupquadroots[incomegroup], gxScale, grScale, padding)(incomegroup_d);

            bubbles.push(d);
            quadroot.add(d);
            regionquadroots[region].add(region_d);
            incomegroupquadroots[incomegroup].add(incomegroup_d);
        }
    });
    return bubbles;
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

        if(!(year in countries[code])){
            countries[code][year] = {};
        }
        if(!(metric in metrics)){
            metrics[metric] = {"id": metric, "label": item.Series_with_units}
        }
        if(!(year in metrics[metric])){
            metrics[metric][year] = []
        }

        countries[code][year][metric] = {
            "id": metric,
            "value": item.Value,
            "rank": item.Rank,
            "country": countries[code],
            "label": item.Series_with_units
        }
        metrics[metric][year].push(countries[code][year][metric]);
    });

    return {"countries": countries, "metrics": metrics};
}

function buildLines(axes){
    var nrRegions = Object.size(gRegions);
    var nrIncomeGroups = Object.size(gIncomegroups);
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
function showLines(axes, view){

    axes.selectAll(".axis").transition().duration(500)
        .style("opacity", 0);
    axes.selectAll("." + view).transition().delay(500).duration(1000)
        .style("opacity", 1);
}

function getNrBubbleCharts(view){
    switch(view) {
    case "region":
        return Object.size(gRegions);
        break;
    case "incomegroup":
        return Object.size(gIncomegroups);
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
    bubbleLine.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("r", function(d){ return grScale(d.r);})
        .attr("fill", function(d){ return gcolorScale(d.x); })

        .attr("cx", function(d){ return d.cx; })
        //.attr("cy", 0)
        //.transition().delay(i).duration(1000)
        //.transition().duration(1500)
        .attr("cy", function(d){ return d.cy; });


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
              var d = this.__data__, c = gcolorScale(parseFloat(d.x));
              return '<div class="tipsyinfo">'
                   + '  <div class="tipsyrow noborder"><div class="tipsylabel">Country</div><div class="value">' + d.properties.country.name + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Population</div><div class="value">' + d.properties.country.population  + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Region</div><div class="value">' + d.properties.country.region  + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Income group</div><div class="value">' + d.properties.country.incomegroup  + '</div></div>'
                   + '  <div class="tipsyrow"><div class="tipsylabel">Value</div><div class="value">' + d.x + '</div></div>'
                   + '</div>'
            }
        })


}

function transitionView(view){
    if(view == gCurrentView)
        return;
    var svg = d3.select("svg");
    var duration = 1000;

    var currentHeight = getSvgHeight(gCurrentView);
    var height = getSvgHeight(view);
    var heightDuration = height < currentHeight ? duration *2 : duration;
       svg
          .transition()
          .duration(heightDuration)
          .style("height", height + "px");

    showLines(svg.select("#axes"), view);
    circles = svg.selectAll("circle")
        .data(gData)
        .transition()
        .duration(duration)
        .delay(function(d){ return (6-d.x)*200});

    if(view == "region"){
        circles.attr("cy", function(d){return (gRegions[d.properties.country.region]+1)*(gBubbleHeight) - gInitialPosition + d.region_cy  });
    }
    else if(view == "incomegroup"){
        circles.attr("cy", function(d){return (gIncomegroups[d.properties.country.incomegroup]+1)*(gBubbleHeight) - gInitialPosition + d.incomegroup_cy });
    }
    else if(view == "global"){
        circles.attr("cy", function(d){return d.cy });
    }

    gCurrentView = view;
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
                //console.log('x axis is fine for ' + d.properties.country.name + ' ' + d.r);
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


