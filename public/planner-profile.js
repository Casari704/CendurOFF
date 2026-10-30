// ---------------------------------------------------------------
// CendurOFF – profil pro plánovač tras BRouter (brouter.de)
//
// Profil se skládá v prohlížeči podle zvolené preference a nahraje se na
// server BRouteru jako "custom" profil. Čísla jsou "cena za metr" – čím
// menší, tím raději tudy plánovač vede. 1 = nejoblíbenější, 10000 = zákaz.
//
//   mode: 'teren' | 'mix' | 'silnice'
//   allowPaths: true/false – smí trasa vést po pěšinách (path, footway…)
// ---------------------------------------------------------------
(function(){

const COSTS = {
  //            hrubé  štěrk  zpev.  pěšina  chodník  cyklo  vedlejší  III.   II.    I.    rychlost.
  teren:   { rough:1.0, gravel:1.05, pavedtrack:1.6, path:1.15, foot:1.8, cycle:1.8, minor:1.7,  tertiary:2.0,  secondary:2.4, primary:3.0, trunk:6.0 },
  mix:     { rough:1.0, gravel:1.0,  pavedtrack:1.2, path:1.6,  foot:2.5, cycle:1.6, minor:1.2,  tertiary:1.3,  secondary:1.5, primary:2.0, trunk:4.0 },
  silnice: { rough:2.5, gravel:2.0,  pavedtrack:1.4, path:4.0,  foot:6.0, cycle:2.0, minor:1.15, tertiary:1.05, secondary:1.0, primary:1.1, trunk:1.6 }
};

function num(x){ return String(Math.round(x*100)/100); }

function buildProfile(mode, allowPaths){
  const c = COSTS[mode] || COSTS.teren;
  const pathCost = allowPaths ? c.path : 10000;
  const footCost = allowPaths ? c.foot : 10000;
  return `# CendurOFF enduro profil (${mode}, pesiny ${allowPaths ? 'ano' : 'ne'})

---context:global

assign downhillcost 0
assign downhillcutoff 0
assign uphillcost 0
assign uphillcutoff 0

assign validForBikes 1
assign validForCars 1
assign turnInstructionMode 0

assign c_rough      ${num(c.rough)}
assign c_gravel     ${num(c.gravel)}
assign c_pavedtrack ${num(c.pavedtrack)}
assign c_path       ${num(pathCost)}
assign c_foot       ${num(footCost)}
assign c_cycle      ${num(c.cycle)}
assign c_minor      ${num(c.minor)}
assign c_tertiary   ${num(c.tertiary)}
assign c_secondary  ${num(c.secondary)}
assign c_primary    ${num(c.primary)}
assign c_trunk      ${num(c.trunk)}

---context:way

assign turncost 20
assign initialcost switch route=ferry 20000 0

assign ispaved surface=asphalt|paved|concrete|paving_stones|sett|cobblestone
assign isunpaved surface=unpaved|gravel|ground|dirt|grass|compacted|sand|pebblestone|fine_gravel|earth|mud|clay|rock|stone|grass_paver

# kvalita lesní/polní cesty
assign trackcost
  switch tracktype=grade1 c_pavedtrack
  switch tracktype=grade2 c_gravel
  switch tracktype=grade3|grade4|grade5 c_rough
  switch ispaved c_pavedtrack
  c_rough

# silnice s nezpevněným povrchem se chovají jako polní cesta
assign roadcost
  switch isunpaved c_gravel
  switch or highway=trunk highway=trunk_link c_trunk
  switch or highway=primary highway=primary_link c_primary
  switch or highway=secondary highway=secondary_link c_secondary
  switch or highway=tertiary highway=tertiary_link c_tertiary
  c_minor

assign onewaypenalty
  switch switch reversedirection=yes
                switch oneway=
                       junction=roundabout
                       or oneway=yes or oneway=true oneway=1
                oneway=-1
         10000
         0

assign privatepenalty switch access=private|military 3 0

assign basecost
  switch highway=motorway|motorway_link|steps|construction|proposed|abandoned|raceway|platform|corridor|elevator|via_ferrata|bus_stop|rest_area|services 10000
  switch highway=track trackcost
  switch highway=path|bridleway switch ispaved c_cycle c_path
  switch highway=footway|pedestrian c_foot
  switch highway=cycleway switch isunpaved c_gravel c_cycle
  switch highway=unclassified|residential|living_street|service|road roadcost
  switch highway=trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|busway roadcost
  10000

assign costfactor
  switch equal basecost 10000 10000
  add basecost add privatepenalty switch highway=track|path|bridleway|footway|pedestrian|cycleway 0 onewaypenalty

---context:node

assign initialcost
  switch barrier=gate|lift_gate|swing_gate|sliding_gate|chain|bar|rope 150
  switch barrier=bollard|block|cycle_barrier|motorcycle_barrier|jersey_barrier|kissing_gate|stile|turnstile|full-height_turnstile|wall|fence|hedge|ditch|door 1000
  0
`;
}

if(typeof window !== 'undefined') window.CendurBRouterProfile = buildProfile;
if(typeof module !== 'undefined') module.exports = buildProfile;
})();
