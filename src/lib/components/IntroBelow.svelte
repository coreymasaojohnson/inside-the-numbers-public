<script lang="ts">
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { sineInOut } from 'svelte/easing';

	// Accept state from parent component
	export let activeView = '';
	export let activeScope = '';
	export let activeScale = '';

	// Content object - maps state combinations to title/paragraphs
	const content: Record<string, { title: string; paragraphs: string[] }> = {
		// === MAP VIEW - 6 COMBINATIONS (Category × Scope) ===

		// Combined + County
		'map-view-combined-county': {
			title: "Where We Are, and How We're Growing",
			paragraphs: [
				'Asian American and Pacific Islander (AAPI) communities are shaped by immigration. Nearly two-thirds of Asian Americans and one in six Pacific Islanders were born outside the United States. Together, they number more than 12 million people and are among the fastest-growing immigrant groups in the country. Yet AAPI immigrant perspectives are too often missing from national conversations on immigration. This section explores where AAPI immigrants live, how their numbers have grown, and how our communities continue to shape the nation.\n\nCounty-level data reveals AAPI immigrant settlement far more concentrated than overall population maps suggest. Los Angeles, Santa Clara, and Queens counties alone host 2.1 million foreign-born AAPI residents—16% of the national total—anchored by established Chinatowns, Koreatowns, Little Manilas, and tech sector employment pipelines.',
				" The Bay Area's six-county cluster (including Alameda, San Mateo, and San Francisco) contains another 1 million AAPI immigrants, driven by H-1B visa concentrations in tech, venture capital networks favoring Asian entrepreneurs, and university systems serving as permanent residency pathways.\n\nBeyond traditional gateways, emerging hubs show rapid growth rates: Harris County (Houston) grew from 250,000 to 320,000 AAPI immigrants between 2010-2020, fueled by oil/gas industry recruitment and refugee resettlement through Catholic Charities. Franklin County (Columbus) and Cuyahoga County (Cleveland) absorbed 18,000 Bhutanese and Burmese refugees in a single decade, transforming North Hill into one of America's most linguistically diverse neighborhoods with 30 languages spoken. Meanwhile, Orange County (Florida) saw Vietnamese and Filipino populations double as theme park tourism and hospitality sectors actively recruited bilingual workers.",
				'Small-county concentrations reveal targeted settlement patterns invisible in state totals: Washington County, Arkansas, hosts 4,400 Marshallese immigrants (5% of county population) working Tyson Foods poultry plants through Compact of Free Association migration; Whitfield County, Georgia, became majority-Latino with significant Burmese refugee presence in carpet manufacturing; and Dakota County, Nebraska, attracted Yazidi, Kurdish, and Afghan refugees through meatpacking recruitment despite ranking just 80th nationally for overall foreign-born population.\n\nUnderstanding our communities requires looking past monolithic labels to the social and economic diversity of the many ethnic groups that make up AAPI populations. By highlighting disaggregated data, we can better recognize the needs of the most vulnerable while showing the breadth of contributions AAPI immigrants make to U.S. society. '
			]
		},

		// Combined + State
		'map-view-combined-state': {
			title: 'Beyond the Coasts: AAPI Settlement in Unexpected Places',
			paragraphs: [
				"State-level patterns reveal AAPI immigrant concentrations far from traditional coastal gateways. Alaska stands out with AAPI residents comprising 10% of the overall state population—significantly higher than the national average—driven by Filipino communities working in canneries since the early 1900s and sustained by military and federal employment.\n\nOn the East Coast, Virginia's Hampton Roads region anchors one of the world's largest naval concentrations, with Filipino Americans forming a substantial community connected to military service at Naval Station Norfolk and nearby bases.",
				"The Great Lakes and Midwest tell a refugee resettlement story. Ohio received over 8,000 Bhutanese refugees between 2010-2018, with Columbus now hosting the nation's largest Bhutanese community at 27,000 residents. Akron's North Hill neighborhood became one of America's most linguistically diverse areas with 30 languages spoken, while Cleveland and Pennsylvania cities like Pittsburgh welcomed additional Bhutanese and Burmese refugees. Missouri's St. Louis emerged as the 21st-largest refugee destination despite ranking just 60th for overall foreign-born population, initially through Bosnian resettlement and later Southeast Asian refugees.",
				"These patterns reflect coordinated federal refugee resettlement programs, military installations' demographic influence, and secondary migration as established communities attract newcomers from other states. Georgia's growing Atlanta metro exemplifies emerging Southern AAPI hubs, while university towns across these regions—from Blacksburg to Columbia—sustain smaller but significant AAPI populations through academic and healthcare employment.\n\nState totals mask local variation, so toggle to county-level to compare AAPI concentrations in specific metropolitan clusters."
			]
		},

		// Asian + County
		'map-view-asian-county': {
			title: 'Tech Corridors and University Towns: Asian Immigrant Geography',
			paragraphs: [
				"Asian immigrant settlement at the county level tracks employment visa pathways with remarkable precision. Santa Clara County (Silicon Valley) hosts 650,000 Asian immigrants—half of the Bay Area's AAPI foreign-born population—with Indian and Chinese immigrants comprising 75% of this total through H-1B-to-green card pipelines at Google, Apple, Meta, and thousands of startups. Adjacent Alameda County (encompassing Oakland and Berkeley) adds another 280,000 Asian immigrants, anchored by UC Berkeley's graduate programs in engineering and computer science that serve as permanent residency funnels. Meanwhile, King County (Seattle) saw Asian immigrant populations surge 45% from 2010–2020 as Amazon, Microsoft, and Boeing recruited globally, making it a second major West Coast tech hub.\n\nThese patterns are mirrored in major East Coast financial and pharmaceutical corridors, with Middlesex County, New Jersey, serving as a prime example. These concentrated clusters illustrate a settlement geography tethered to corporate recruitment and professional opportunities.",
				'University towns far from the coasts show Asian immigrant concentrations wildly exceeding regional averages, illustrating how high-skill visas create internal "magnets" across the country. Centre County, Pennsylvania (Penn State) features Asian residents at 8% versus just 3% statewide; Story County, Iowa (Iowa State), shows 6% Asian representation in a state averaging barely 2%; and Tompkins County, New York (Cornell), reaches 9% Asian presence despite upstate New York\'s minimal overall immigration. The University of Illinois\'s Champaign County shows a highly concentrated Asian population (11% overall), driven largely by its top-tier engineering and science graduate schools.\n\nThese distinct clusters reflect powerful student-to-faculty pipelines, postdoctoral researcher visa conversions, and competitive medical residency programs in university hospitals. The resulting Asian population shares in these counties are often three to five times the state average, demonstrating a migration pattern fundamentally driven by advanced degree attainment, disproportionately utilized by Chinese, Indian, and Korean immigrants',
				"The absence of color in rural counties reveals where employment visa pathways don't reach: agricultural regions, manufacturing belt counties, and Appalachian areas show Asian immigrant populations under 0.5%. This demographic void reflects the fact that the H-1B, L-1, and O-1 visa categories—the primary drivers of modern Asian immigration—are structurally tied to high-wage, specialized jobs located in urban centers.\n\nThis geographic sorting has significant policy implications. First, it highlights a stark talent divide where highly educated immigrants cluster in a few megaregions. Second, Asian immigrants face different integration challenges (such as credential recognition and family separation during visa processing) than refugee or agricultural worker populations, requiring targeted services in tech corridor metros rather than broad rural outreach.\n\nToggle to state view for regional patterns, or switch to NHPI to see how military and Compact of Free Association migration create entirely different geographic footprints."
			]
		},

		// Asian + State
		'map-view-asian-state': {
			title: 'Employment Visas and Family Ties: State-Level Asian Immigration Patterns',
			paragraphs: [
				'State-level Asian immigrant distribution reflects three decades of H-1B visa geography and family reunification backlogs. California (4.2 million), New York (1.6 million), Texas (1.2 million), New Jersey (850,000), and Washington (500,000) comprise 60% of Asian immigrants nationwide—but their composition differs dramatically.\n\nCalifornia and New York host established Chinese, Filipino, and Korean communities dating to pre-1965 immigration, with family reunification now driving 65% of entries.\n\nMeanwhile, Texas and Washington saw explosive post-2000 growth through employment visas: Indian immigrants in Texas grew 350% from 2000-2020 as Dallas and Houston emerged as tech sector hubs.',
				"Midwest and Southern states reveal divergent Asian immigration stories. Ohio and Pennsylvania absorbed primarily Bhutanese and Burmese refugees through coordinated resettlement (18,000 to Ohio alone), creating distinct Asian communities in Columbus, Cleveland, and Pittsburgh, with median incomes 40% below state averages and limited English proficiency exceeding 50%.\n\nConversely, North Carolina, Georgia, and Virginia saw Indian and Chinese immigrant growth through biotech development in the Research Triangle, Atlanta's corporate headquarters expansion, and Northern Virginia federal contractor hiring—populations with college degree attainment above 70% and median household incomes exceeding $100,000.",
				'The geographic sorting has profound equity implications: California\'s Cambodian, Hmong, and Laotian refugee communities (300,000 combined) face poverty rates double the Asian American average but disappear into aggregate "Asian" statistics that show the group outperforming whites economically. Meanwhile, Great Plains states with minimal Asian populations (under 1%) lack language access infrastructure, making isolated Indian or Vietnamese families navigate healthcare, education, and employment systems without interpretation services.\n\nState totals reveal regional concentration patterns. Toggle to county view to see how Asian immigrants cluster in specific metros—Austin, Raleigh, Columbus—creating service delivery challenges distinct from broadly distributed populations.'
			]
		},

		//NHPI + County
		'map-view-nhpi-county': {
			title: 'Invisible Clusters: NHPI Communities Hidden by the Zero-to-Trace Range',
			paragraphs: [
				"County-level NHPI data exposes a critical visibility problem: most counties show 0.0% (gray) because populations under 100 don't register as percentages. Yet, those \"zero\" counties may still host isolated Marshallese, Chuukese, or Tongan families without interpretation services, COFA-status legal assistance, or diabetes screening tailored to Pacific Islander genetic profiles.\n\nWashington County, Arkansas, shows 4,400 NHPI residents—the nation's highest concentration outside Hawai‘i—driven by Marshallese migration to Tyson Foods poultry plants through Compact of Free Association treaties. Neighboring Benton County adds another 2,000 Marshallese residents, giving Northwest Arkansas more Marshallese immigrants than the entire U.S. foreign-born population from Samoa. Across the border in Oklahoma's Garfield County, 1,400 Marshallese work in meatpacking under similar COFA migration patterns, yet these communities remain invisible in state population totals showing just 0.1% NHPI presence overall.",
				'Military installation counties create NHPI population spikes invisible in broader state totals: San Diego County, California (Camp Pendleton), Pierce County, Washington (Joint Base Lewis-McChord), and Montgomery County, Tennessee (Fort Campbell), all show elevated NHPI percentages driven by Samoan, Tongan, and Chamorro military service at rates 3-5 times the national average. Beyond active-duty personnel, the population of Virginia Beach (Joint Expeditionary Base Little Creek-Fort Story and Naval Air Station Oceana) demonstrates how even smaller installations attract and anchor regional NHPI clusters through extended family networks.\n\nThese communities face unique challenges—frequent relocations disrupt healthcare continuity, military housing policies discriminate against extended family structures common in Pacific Islander cultures, and VA health systems lack Pacific Islander-specific diabetes and cardiovascular disease screening despite these conditions occurring at rates 2-3 times higher than the general population.',
				"Some dark purple outliers—San Juan County, Utah (22%) and Price County, Wisconsin (39%)—aren't NHPI population centers but statistical artifacts: San Juan has just 40 NHPI residents among 240 foreign-born, while Price has 81 NHPI among 207 total immigrants. These percentages reflect extreme denominator effects in low-immigration counties where even a handful of families registers a high rate. For substantial, policy-relevant concentrations, the focus must shift to true micro-clusters. Orange County, California, hosts significant, longstanding Samoan diaspora communities stemming from historical migration patterns. Likewise, Salt Lake County, Utah, forms a major hub for Tongan and Samoan immigration linked to Church of Jesus Christ of Latter-day Saints (LDS) kinship networks and employment in logistics and healthcare. \n\nToggle to state view to better understand how NHPI populations—just 390,000 nationwide—create scattered micro-clusters requiring targeted outreach rather than broad infrastructure."
			]
		},

		// NHPI + State
		'map-view-nhpi-state': {
			title: 'From Hawai‘i to the Heartland: NHPI Migration Through Military and COFA Ties',
			paragraphs: [
				"State-level NHPI data tells a migration story fundamentally different from Asian immigration patterns. Hawai‘i stands out: 9.8% of its foreign-born population is NHPI—yet this still undercounts Pacific Islanders because people born in U.S. territories like American Samoa (U.S. nationals) are treated as native-born, not foreign-born, despite being immigrants in practical terms.\n\nAlaska's 5.5% NHPI foreign-born population is uniquely driven by Micronesian groups—notably Marshallese and Chuukese—who migrate under the Compacts of Free Association (COFA), often seeking better health and economic opportunities, while Samoan is a top non-English language in Anchorage schools. Washington, Oregon, and California show 1-2% through secondary migration from Hawai‘i, reflecting military base concentrations and longstanding Samoan diaspora communities.",
				"The Heartland's NHPI populations—seemingly invisible at state scale—represent specific, targeted migration streams requiring distinct policy responses. Arkansas shows just 0.4% NHPI statewide, but Washington and Benton counties host 8,000 Marshallese immigrants (1.2-1.5% locally) working poultry processing under Compact of Free Association status that grants visa-free U.S. entry but denies Medicaid eligibility. Utah's 0.8% NHPI captures concentrated Tongan communities in Salt Lake County (20,000 residents), drawn by LDS Church connections and secondary migration from Hawai‘i and California. Missouri and Iowa's <0.3% NHPI includes Micronesian meatpacking workers in Springdale and Storm Lake facing housing discrimination, occupational injury, and COVID-19 infection rates 7-9 times state averages—crises invisible when Pacific Islanders comprise under 1% of state populations.",
				"Small NHPI shares (0.1–0.3%) across parts of the Great Plains and Southeast coincide with a classification gap: \"Other NHPI\" comprises 260,000 of the 390,000 NHPI foreign-born nationally, meaning two-thirds of Pacific Islander immigrants aren't separately tracked by origin. We don't know if Montana's NHPI population are Marshallese refugees from climate displacement, Samoan military families, or Chuukese secondary migrants—yet health outcomes, COFA legal status, and integration needs vary dramatically.\n\nRevised 2024 federal data standards mandate Marshallese, Samoan, Chamorro, Tongan, and Fijian disaggregation, but implementation will take time. Until then, state-level NHPI percentages represent populations spending decades outside federal measurement systems, unable to access targeted services because they statistically don't exist."
			]
		},

		// === TREEMAP VIEW ===
		'treemap-view-combined': {
			title: 'Two Communities, One Category: The AAPI Immigrant Landscape',
			paragraphs: [
				'This combined view shows all foreign-born AAPI residents, revealing the stark size difference between Asian (over 12 million) and Pacific Islander (under 400,000) immigrant populations. Asian groups dominate visually because they constitute 97% of AAPI immigrants, while Pacific Islanders—despite being the fastest-growing population group—remain just 3% due to smaller baseline populations, U.S. territorial status for many island nations, and persistent undercounting in federal data collection.',
				'The visual imbalance reflects migration pathways shaped by different histories: most Asian immigration flows through employment visas (especially for Indian and Korean immigrants) and family reunification (especially for Vietnamese, Filipino, and Bangladeshi immigrants), while Pacific Islander migration operates through Compacts of Free Association with Micronesian nations, military service connections, and inter-island movement within U.S. territories that complicates immigrant/native-born classifications.',
				'Treat this combined visualization as a cautionary starting point. The 45-to-1 population ratio means Pacific Islander experiences—including Marshallese meatpacking workers in Arkansas, Samoan military families, and Chuukese communities facing displacement—get functionally erased in aggregate statistics. Without disaggregation by specific origin, policy interventions risk serving neither community well, perpetuating the model minority myth for Asians while rendering Pacific Islanders invisible in national immigration conversations.'
			]
		},

		'treemap-view-asian': {
			title: 'Diverse Origins, Divergent Pathways: The Asian Immigrant Mosaic',
			paragraphs: [
				'Five countries—China, India, Philippines, Vietnam, and Korea—account for 67% of all Asian immigrants and anchor this treemap, but their immigration stories differ fundamentally. Indian and Korean immigrants arrive predominantly through H-1B employment visas (72% of H-1B petitions go to Indians), while Vietnamese, Bangladeshi, and Pakistani immigrants use family reunification pathways at rates exceeding 90%. Meanwhile, Bhutanese, Burmese, and Afghan immigrants entered primarily as refugees, with over 8,000 Bhutanese resettled in Ohio alone between 2010-2018.',
				'Mid-sized and emerging groups reveal 21st-century migration patterns: Nepalese, Bhutanese, Burmese, and Mongolian immigrants are majority recent arrivals (entered within the past decade), driven by refugee resettlement and secondary migration to cities like Columbus, Akron, and St. Louis. These newer communities face vastly different economic realities than earlier arrivals—median household income spans from $100,500 for Asian Indians to $55,000 for Burmese and Nepalese Americans, while college degree attainment ranges from 75% for Indians to under 20% for Bhutanese, Cambodian, and Laotian Americans.',
				'The smaller boxes demolish the "model minority" myth through data: Hmong, Cambodian, and Laotian communities—refugees from Southeast Asian conflicts—experience poverty rates above the national average, limited English proficiency rates exceeding 45%, and educational attainment below that of Black and Latino Americans. Yet aggregated "Asian American" statistics mask these disparities entirely, making disaggregated data essential for language access programs, refugee services, healthcare interventions, and equitable resource allocation that actually serves the full spectrum of Asian immigrant experiences.'
			]
		},

		'treemap-view-nhpi': {
			title: 'The "Other" Problem: Pacific Islander Invisibility in Federal Data',
			paragraphs: [
				'"Other NHPI" dominates this treemap not because one community is largest, but because federal data systems collapse dozens of distinct Pacific Islander nations—Marshallese, Chuukese, Pohnpeian, Kosraean, Palauan, Yapese, i-Kiribati, Tuvaluan, Tokelauan, Niuean, and others—into a single residual category. \n\nThis aggregation obscures a population of over 2,100 islands across Micronesia, Melanesia, and Polynesia, each with unique languages, migration histories, and legal relationships to the United States shaped by Compacts of Free Association, military occupation legacies, and colonial administration.',
				'Disaggregated health data from Hawai‘i\'s COVID-19 response reveals what gets hidden: Marshallese residents experienced infection rates of 10,580 per 100,000—seven times higher than aggregate "Pacific Islander" rates and nine times higher than Native Hawaiians. "Unspecified Micronesian" households earn a median $30,000 annually (compared to $100,500 for Asian Indians), and just 5.2% hold college degrees—lower than any other detailed racial group. Meanwhile, Micronesians working in Iowa and Arkansas meatpacking plants, Marshallese communities in Springdale navigating Compact of Free Association status, and Chuukese families facing housing discrimination remain statistically invisible in national datasets.',
				'The oversized "Other NHPI" box is a data justice issue, not a demographic reality. Pacific Islander advocates describe this aggregation as "functional erasure"—when communities are 45 times smaller than Asian Americans, grouping them together means Pacific Islander health crises, economic struggles, and policy needs disappear into AAPI averages. Federal data standards updated in 2024 now require separate reporting for Marshallese, Samoan, Chamorro, Tongan, and Fijian populations, but implementation remains incomplete. Treat this category as an urgent call for better disaggregation, deeper community-led data collection, and recognition that "Other" is where visibility goes to die.'
			]
		},

		// === GROWTH OVER TIME ===
		// Combined - Absolute Scale
		'growth-over-time-combined-absolute': {
			title: "A Decade of Acceleration: AAPI Immigration's Post-Recession Surge",
			paragraphs: [
				"Between 2009 and 2019, the foreign-born AAPI population grew from 10.8 million to 13.2 million—adding 2.4 million immigrants in a decade marked by economic recovery, tech sector expansion, and intensified refugee crises. Asian immigrants drove this growth from 10.5 million to 12.8 million, while Pacific Islander immigrants expanded from 310,000 to 390,000.\n\nThe post-2010 surge coincided with H-1B visa demand hitting statutory caps annually, family reunification backlogs clearing for Philippines and Vietnam, and the Obama administration's refugee resettlement expansion that brought 90,000 Bhutanese and 70,000 Burmese refugees between 2008-2016.",
				"Absolute numbers reveal sharp divergence within this decade: established groups like Chinese and Indian immigrants each added 600,000+ people through employment and student pathways, while newer streams exploded from near-invisibility—Nepalese immigrants tripled from 60,000 to 180,000 (accelerating after Nepal's 2015 earthquakes), Burmese populations doubled as Rohingya and ethnic minority refugees fled military persecution, and Afghan/Iraqi interpreters arrived through Special Immigrant Visas following U.S. troop drawdowns. \n\nYet \"Other Asian\" grew by 140,000 during this same period, not from one emerging group but from measurement lag: Mongolians, Central Asians, and secondary migrants from refugee camps who didn't fit 2010 Census's newly expanded but still insufficient checkbox list.",
				'The raw population curves mask a critical inflection point: 2010\'s Census form updates added "Bhutanese" and "Burmese" checkboxes, temporarily reducing "Other Asian" by disaggregating 140,000 refugees—but within five years, new arrivals refilled this residual category with Afghan interpreters, Rohingya asylum seekers, and Uzbek/Kazakh immigrants fleeing Central Asian instability. By 2019, "Other Asian" exceeded 700,000 and "Other NHPI" reached 260,000—together comprising nearly 1 million AAPI immigrants whose population growth, occupational concentration, and health outcomes remain unmeasured. One-quarter of the AAPI population increase occurred in communities that federal data systems don\'t separately track, can\'t monitor for disparities, and effectively treat as statistical noise rather than distinct populations needing culturally specific services.'
			]
		},

		// Combined - Indexed Scale
		'growth-over-time-combined-indexed': {
			title: 'The 2010 Disaggregation Dividend: What Happens When Census Finally Catches Up',
			paragraphs: [
				'Indexed growth rates from 2009-2019 expose how Census form changes reshape what we can see. Bhutanese immigrants showed 180% growth (from 60,000 to 170,000) and Burmese 145% growth (from 100,000 to 245,000)—but these explosive trajectories only became visible after 2010 Census added dedicated checkboxes. Before 2010, these same refugees inflated "Other Asian" totals; after 2010, their growth appeared in distinct categories, enabling targeted language access, health screening for tuberculosis and hepatitis B, and refugee service coordination in resettlement hubs like Columbus, Akron, and Fort Wayne. Meanwhile, Nepalese growth hit 200% but wasn\'t separately enumerated until 2010, meaning half their population increase (2009-2019) occurred while statistically invisible.',
				'The indexed view reveals a disturbing pattern: Pacific Islander growth outpaced Asian growth (26% vs. 22% overall), but this aggregate masks that "Other NHPI" grew 45%—far exceeding Samoan (18%), Tongan (35%), or Chamorro (12%) growth rates. This isn\'t demographic triumph; it\'s measurement failure. The 45% "Other NHPI" increase captures Marshallese migration to Arkansas meatpacking plants (Springdale\'s Marshallese population reached 15,000 by 2019), Chuukese families displaced by Honolulu housing costs, and Palauan communities in California—none separately counted. When researchers cite "Pacific Islanders as fastest-growing," they\'re often referencing "Other" category expansion without acknowledging these are real communities that Census forms still don\'t enumerate.',
				'Indexed scaling transforms 2010 Census updates into a natural experiment: what happens to communities when they finally get checkboxes? Bhutanese and Burmese disaggregation enabled Ohio to track refugee health outcomes, identify high rates of vitamin D deficiency and depression, and deploy Nepali and Karen interpreters to pediatric clinics. But Mongolian immigrants (78,000 by 2019, up 120% from 2009) remain in "Other Asian," meaning their concentrations in mining states and construction sectors stay unmeasured. Afghan and Iraqi interpreters (65,000+ arrived 2009-2019) appear in "Other Asian" despite distinct migration circumstances and PTSD rates. The decade\'s lesson: disaggregation isn\'t administrative housekeeping—it\'s the difference between visibility and erasure, between targeted interventions and one-size-fits-none policies that serve neither emerging communities nor established groups well.'
			]
		},

		// Asian - Absolute Scale
		'growth-over-time-asian-absolute': {
			title: 'Tech Boom Meets Refugee Crisis: The Dual Story of 2009-2019 Asian Growth',
			paragraphs: [
				'Asian immigrant population growth from 2009-2019 split into two parallel streams: employment-driven expansion among established groups and humanitarian arrivals among emerging populations. Indian immigrants added 700,000 (from 1.75M to 2.45M), Chinese added 650,000 (from 2.1M to 2.75M), and Filipinos added 250,000—driven by H-1B visas hitting annual caps of 85,000 within days of opening, tech sector growth in Seattle and Bay Area, and healthcare worker recruitment. Simultaneously, refugee populations surged: Bhutanese from 60,000 to 170,000 (110,000 added), Burmese from 100,000 to 245,000 (145,000 added), and Nepalese from 60,000 to 180,000 (120,000 added, accelerating post-2015 earthquakes).',
				'The "Other Asian" category absorbed 140,000 additional immigrants during this decade despite 2010 Census updates that should have reduced it by disaggregating Bhutanese and Burmese refugees. This paradox reveals composition churn: as some groups gained visibility, new streams replaced them—Afghan and Iraqi Special Immigrant Visa holders (22,000 Afghans arrived 2009-2016 alone), Rohingya asylum seekers fleeing Myanmar\'s 2015-2017 military campaigns, Mongolian immigrants growing from 45,000 to 78,000 through mining sector recruitment, and Central Asian populations (Uzbek, Kazakh, Kyrgyz) fleeing post-Soviet economic instability. By 2019, "Other Asian" reached 720,000—6% of all Asian immigrants, representing roughly 40 distinct ethnic groups without separate Census enumeration.',
				'Absolute growth numbers expose resource allocation blindspots: the 375,000 refugees added 2009-2019 (Bhutanese, Burmese, Afghan, Iraqi, Rohingya combined) matched the entire Vietnamese immigrant population growth from 1975-1985, yet received fragmented services because only Bhutanese and Burmese had distinct checkboxes enabling targeted health assessments and language access. Meanwhile, the 700,000 Indian immigrants added fueled tech sector growth but also concentrated in visa-dependent positions vulnerable to H-1B policy shifts. When federal agencies report "Asian immigrants added 2.3 million 2009-2019," they\'re aggregating populations whose economic realities span from $120,000 median household income (Asian Indians in tech) to $35,000 (Bhutanese and Nepalese refugees), whose English proficiency ranges from 90% (Filipino nurses) to 20% (Burmese Chin refugees).'
			]
		},

		// Asian - Indexed Scale
		'growth-over-time-asian-indexed': {
			title: 'The "Other Asian" Treadmill: Census Disaggregation Can\'t Keep Pace with Migration',
			paragraphs: [
				'Indexed growth rates from 2009-2019 reveal the futility of incremental Census updates: Nepalese immigrants grew 200%, Bhutanese 183%, Burmese 145%, and Mongolians 120%—but only two of these four groups received 2010 checkboxes, meaning half this explosive growth remained invisible. The pattern repeats across smaller populations: Afghan immigrants grew an estimated 140% (from 47,000 to 113,000) but stayed aggregated in "Other Asian" because Census forms include only one "Middle Eastern" option (Iranian, added 1980). Pakistani and Bangladeshi immigrants—now 450,000 and 230,000 respectively—grew 45% and 65% during this decade, yet their community health profiles remain obscured by aggregation with Indian data despite vastly different immigration pathways.',
				'The "Other Asian" growth rate—120% indexed from 2009-2019—functions as a measurement failure indicator, tracking communities that grew explosively while categorically invisible. Rohingya refugees (estimated 20,000-30,000 arrivals 2015-2019) appear entirely within "Other Asian" despite distinct persecution history and statelessness issues. Central Asian immigrants—Uzbeks fleeing Andijan massacre aftermath, Kazakhs and Kyrgyz navigating post-Soviet transitions—collectively grew 180% to over 90,000 but remain aggregated. Mongolian immigrants, concentrated in Nevada mining and Colorado construction sectors, grew from 45,000 to 78,000 yet receive no occupational injury tracking specific to their employment patterns because "Other Asian" combines them with Afghan interpreters, Rohingya refugees, and Hmong secondary migrants.',
				'Indexed scaling exposes the disaggregation dividend: after 2010 separated Bhutanese and Burmese into distinct checkboxes, these communities received targeted interventions—Ohio\'s Bhutanese Health Initiative identified high rates of hypertension and diabetes through culturally specific screening, Fort Wayne deployed Burmese Karen interpreters to obstetric clinics, and refugee resettlement agencies calibrated mental health services to address war trauma and displacement. Meanwhile, Afghan interpreters (65,000+ arrived 2009-2019, 140% growth) remained in "Other Asian," receiving generic "Asian American" mental health services inadequate for PTSD stemming from combat interpretation. The decade\'s lesson: 120% "Other Asian" growth isn\'t demographic fact—it\'s evidence that federal classification systems are systematically 10-15 years behind actual migration patterns, creating expanding blind spots where populations grow fastest.'
			]
		},

		// NHPI - Absolute Scale
		'growth-over-time-nhpi-absolute': {
			title: 'Invisible Acceleration: Pacific Islander Immigration in the Measurement Gap',
			paragraphs: [
				"Pacific Islander immigrant populations grew from 310,000 in 2009 to 390,000 in 2019—an 80,000-person increase (26%) that appears modest until disaggregation reveals the crisis underneath. Samoan immigrants grew from 48,000 to 57,000 (+9,000), Tongans from 18,000 to 24,000 (+6,000), and Chamorros from 12,000 to 13,000 (+1,000). But \"Other NHPI\" exploded from 190,000 to 275,000—adding 85,000 people and comprising 106% of total NHPI immigrant growth. This isn't mathematical error; it's measurement collapse. The entire decade's Pacific Islander immigration growth occurred in the unmeasured residual category while specified groups grew minimally.",
				'The absolute numbers capture Compact of Free Association (COFA) migration that federal statistics systematically undercount. Marshallese immigrants grew from an estimated 12,000 in 2009 to 30,000+ by 2019, driven by climate change impacts on Marshall Islands (sea level rise forcing relocation), Kwajalein Atoll lease renewals with U.S. military, and labor recruitment to Arkansas and Iowa meatpacking plants. Chuukese populations in Honolulu doubled as Micronesian families faced housing displacement and sought better educational access. Palauan, Kosraean, and Pohnpeian communities expanded through inter-island migration chains. Yet all appear as generic "Other NHPI" because Census forms include checkboxes only for Native Hawaiian, Samoan, Chamorro, Tongan, and Fijian.',
				'Absolute growth reveals brutal arithmetic: the 85,000 "Other NHPI" increase from 2009-2019 includes at least 12 distinct Micronesian ethnic groups with different languages (Marshallese, Chuukese, Pohnpeian, Kosraean, Palauan, Yapese all mutually unintelligible), different citizenship arrangements (COFA migrants aren\'t immigrants or citizens but something sui generis), and different health profiles. During Arkansas\'s 2019 measles outbreak and subsequent 2020 COVID-19 crisis, public health officials couldn\'t track Marshallese infection rates separately from "Other NHPI" aggregates combining them with Fijians, Micronesians, and mixed-heritage respondents. When federal reports state "NHPI immigrants grew 80,000 from 2009-2019," they\'re describing a population increase that occurred entirely outside their measurement capacity—real families, real communities, real policy needs, statistically invisible.'
			]
		},

		// NHPI - Indexed Scale
		'growth-over-time-nhpi-indexed': {
			title: 'The "Other NHPI" Emergency: When Fastest Growth Meets Total Invisibility',
			paragraphs: [
				'Indexed growth rates from 2009-2019 expose a profound policy failure: "Other NHPI" grew 45%—exceeding Tongan (33%), Samoan (19%), and Chamorro (8%) growth combined—yet this explosive expansion triggered no federal disaggregation response, no targeted health interventions, no recognition that the fastest-growing Pacific Islander category is the one receiving zero community-specific services. The 45% increase captures Marshallese migration accelerating post-2014 as climate change impacts intensified (king tides flooding Majuro, saltwater intrusion destroying crops), Chuukese populations doubling in Honolulu and West Coast cities, and Palauan communities expanding in California and Arkansas through secondary migration from Guam.',
				'The indexed view reveals how COFA status creates enumeration chaos that inflates "Other NHPI" while undercounting actual populations. Marshallese immigrants—estimated 30,000-50,000 by 2019, representing 150% growth from 2009—appear inconsistently because they\'re neither traditional immigrants (no visas required under 1986 COFA treaties) nor U.S. citizens, leading many to report birthplace as "U.S. territories" (incorrect) or skip nativity questions entirely. Springdale, Arkansas\'s Marshallese community reached 15,000 by 2019—individually larger than all Tongan or Chamorro immigrants nationwide—yet appears only as a fraction of aggregate "Other NHPI" totals. When epidemiologists studied 2020 COVID-19 disparities in Arkansas, they found Marshallese infection rates 7-9 times higher than state averages.',
				'Indexed scaling transforms "Other NHPI" from statistical artifact to public health catastrophe: the 45% growth from 2009-2019 correlates with communities facing housing discrimination (Micronesian families in Honolulu paying 60% of income on rent), occupational concentration in injury-prone sectors (meatpacking, construction, hospitality), and health crises invisible to federal surveillance systems. Hawai‘i\'s COVID-19 response revealed what aggregation hides: when the state finally disaggregated data in 2020, Marshallese residents showed infection rates of 10,580 per 100,000—seven times "Pacific Islander" averages. But this granular data emerged only through community-led contact tracing, not federal surveillance. The 2024 federal standards finally mandate Marshallese enumeration, but implementation lags. Until then, 45% "Other NHPI" growth represents the decade\'s fastest-growing Pacific Islander populations spending 2009-2019 entirely outside federal measurement systems.'
			]
		}
	};

	// Generate key based on current state
	// Map View now has format: "activeScope = 'Category - Scope'" (e.g., "Combined - County")
	// Parse this to create keys like "map-view-combined-county"
	$: stateKey = (() => {
		const view = activeView.toLowerCase().replace(/\s+/g, '-');

		if (activeScale && view === 'growth-over-time') {
			return `${view}-${activeScope.toLowerCase()}-${activeScale.toLowerCase()}`.replace(
				/\s+/g,
				'-'
			);
		}

		if (view === 'map-view' && activeScope.includes(' - ')) {
			// Parse "Combined - County" format into "map-view-combined-county"
			const [category, scope] = activeScope.split(' - ').map((s) => s.toLowerCase().trim());
			return `map-view-${category}-${scope}`;
		}

		// Fallback for other views (treemap, etc.)
		return `${view}-${activeScope.toLowerCase()}`.replace(/\s+/g, '-');
	})();

	// Select content based on state, fallback to default
	$: currentContent = content[stateKey] || content.default;
</script>

<section class="intro-below">
	<div class="site-container">
		<div class="intro-panel">
			{#key stateKey}
				<div
					in:fade={{ duration: 1000, delay: 100, easing: sineInOut }}
					out:fade={{ duration: 100, easing: cubicOut }}
				>
					<h2 class="intro-title">{currentContent.title}</h2>

					<!-- 3-column responsive text block -->
					<div class="intro-columns">
						{#each currentContent.paragraphs as columnText}
							{#each columnText.split('\n\n') as paragraph}
								<p>{paragraph}</p>
							{/each}
						{/each}
					</div>
				</div>
			{/key}
		</div>
	</div>
</section>

<style>
	.intro-below {
		padding-block: 1rem 1.25rem;
	}
	.intro-below .site-container {
		position: relative;
	}

	/* thick, crisp page rule above */
	.intro-below .site-container::before {
		content: '';
		display: block;
		height: 4px; /* strong line */
		background: var(--color-accent-ember);
		margin: 10px 0 18px;
	}

	/* square, no shadow, no radius */
	.intro-panel {
		background: transparent;
		border: 0;
		border-radius: 0;
		box-shadow: none;
		padding: 0;
	}

	/* magazine typography */
	.intro-title {
		font-family: var(--font-serif, Georgia, serif);
		font-weight: 800;
		letter-spacing: 0.003em;
		margin: 0 0 0.5rem 0;
		font-size: clamp(1.15rem, 0.9vw + 1rem, 1.6rem);
		line-height: 1.25;
		color: #085d61;
	}

	.intro-columns {
		column-gap: 2rem;
	}
	.intro-columns p {
		margin: 0 0 1.1rem 0;
		break-inside: avoid;
		font-family: var(--font-serif, Georgia, serif);
		font-size: 1.05rem;
		line-height: 1.6;
	}

	/* responsive columns */
	@media (min-width: 768px) {
		.intro-columns {
			column-count: 2;
		}
	}
	@media (min-width: 1024px) {
		.intro-columns {
			column-count: 3;
		}
	}
</style>
