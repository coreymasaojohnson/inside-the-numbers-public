<script lang="ts">
	// Accept state from parent component
	export let activeView = '';
	export let activeScope = '';
	export let activeScale = '';

	// Content object - maps state combinations to title/paragraphs
	const content: Record<string, { title: string; paragraphs: string[] }> = {
		// Default content
		default: {
			title: "Where We Are, and How We're Growing",
			paragraphs: [
				'Asian American and Pacific Islander (AAPI) communities are shaped by immigration. Nearly two-thirds of Asian Americans and one in six Pacific Islanders were born outside the United States. Together, they number more than 12 million people and are among the fastest-growing immigrant groups in the country.',
				'Yet AAPI immigrant perspectives are too often missing from national conversations on immigration. Understanding our communities requires looking past monolithic labels to the social and economic diversity of the many ethnic groups that make up AAPI populations.',
				'By highlighting disaggregated data, we can better recognize the needs of the most vulnerable while showing the breadth of contributions AAPI immigrants make to U.S. society. This section explores where AAPI immigrants live, how their numbers have grown, and how our communities continue to shape the nation.'
			]
		},

		// === MAP VIEW ===
		'map-view-county': {
			title: "Where We Are, and How We're Growing",
			paragraphs: [
				'Asian American and Pacific Islander (AAPI) communities are shaped by immigration. Nearly two-thirds of Asian Americans and one in six Pacific Islanders were born outside the United States. Together, they number more than 12 million people and are among the fastest-growing immigrant groups in the country.',
				'Yet AAPI immigrant perspectives are too often missing from national conversations on immigration. Understanding our communities requires looking past monolithic labels to the social and economic diversity of the many ethnic groups that make up AAPI populations.',
				'By highlighting disaggregated data, we can better recognize the needs of the most vulnerable while showing the breadth of contributions AAPI immigrants make to U.S. society. This section explores where AAPI immigrants live, how their numbers have grown, and how our communities continue to shape the nation.'
			]
		},

		'map-view-state': {
			title: 'Beyond the Coasts: AAPI Settlement in Unexpected Places',
			paragraphs: [
				"State-level patterns reveal AAPI immigrant concentrations far from traditional coastal gateways. Alaska stands out with AAPI residents comprising 10% of the population—higher than the national average—driven by Filipino communities working in canneries since the early 1900s and sustained by military and federal employment. Virginia's Hampton Roads region anchors one of the world's largest naval concentrations, with Filipino Americans forming a substantial community connected to military service at Naval Station Norfolk and nearby bases.",
				"The Great Lakes and Midwest tell a refugee resettlement story. Ohio received over 8,000 Bhutanese refugees between 2010-2018, with Columbus now hosting the nation's largest Bhutanese community at 27,000 residents. Akron's North Hill neighborhood became one of America's most linguistically diverse areas with 30 languages spoken, while Cleveland and Pennsylvania cities like Pittsburgh welcomed additional Bhutanese and Burmese refugees. Missouri's St. Louis emerged as the 21st-largest refugee destination despite ranking just 60th for overall foreign-born population, initially through Bosnian resettlement and later Southeast Asian refugees.",
				"These patterns reflect coordinated federal refugee resettlement programs, military installations' demographic influence, and secondary migration as established communities attract newcomers from other states. Georgia's growing Atlanta metro exemplifies emerging Southern AAPI hubs, while university towns across these regions—from Blacksburg to Columbia—sustain smaller but significant AAPI populations through academic and healthcare employment. State totals mask local variation, so pair this view with county-level data to see specific metropolitan clusters and compare AAPI concentrations to other immigrant groups."
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
				'"Other NHPI" dominates this treemap not because one community is largest, but because federal data systems collapse dozens of distinct Pacific Islander nations—Marshallese, Chuukese, Pohnpeian, Kosraean, Palauan, Yapese, i-Kiribati, Tuvaluan, Tokelauan, Niuean, and others—into a single residual category. This aggregation obscures a population of over 2,100 islands across Micronesia, Melanesia, and Polynesia, each with unique languages, migration histories, and legal relationships to the United States shaped by Compacts of Free Association, military occupation legacies, and colonial administration.',
				'Disaggregated health data from Hawaii\'s COVID-19 response reveals what gets hidden: Marshallese residents experienced infection rates of 10,580 per 100,000—seven times higher than aggregate "Pacific Islander" rates and nine times higher than Native Hawaiians. "Unspecified Micronesian" households earn a median $30,000 annually (compared to $100,500 for Asian Indians), and just 5.2% hold college degrees—lower than any other detailed racial group. Meanwhile, Micronesians working in Iowa and Arkansas meatpacking plants, Marshallese communities in Springdale navigating Compact of Free Association status, and Chuukese families facing housing discrimination remain statistically invisible in national datasets.',
				'The oversized "Other NHPI" box is a data justice issue, not a demographic reality. Pacific Islander advocates describe this aggregation as "functional erasure"—when communities are 45 times smaller than Asian Americans, grouping them together means Pacific Islander health crises, economic struggles, and policy needs disappear into AAPI averages. Federal data standards updated in 2024 now require separate reporting for Marshallese, Samoan, Chamorro, Tongan, and Fijian populations, but implementation remains incomplete. Treat this category as an urgent call for better disaggregation, deeper community-led data collection, and recognition that "Other" is where visibility goes to die.'
			]
		},

// === GROWTH OVER TIME ===
        // Combined - Absolute Scale
        'growth-over-time-combined-absolute': {
            title: 'A Decade of Acceleration: AAPI Immigration\'s Post-Recession Surge',
            paragraphs: [
                'Between 2009 and 2019, the foreign-born AAPI population grew from 10.8 million to 13.2 million—adding 2.4 million immigrants in a decade marked by economic recovery, tech sector expansion, and intensified refugee crises. Asian immigrants drove this growth from 10.5 million to 12.8 million, while Pacific Islander immigrants expanded from 310,000 to 390,000. The post-2010 surge coincided with H-1B visa demand hitting statutory caps annually, family reunification backlogs clearing for Philippines and Vietnam, and the Obama administration\'s refugee resettlement expansion that brought 90,000 Bhutanese and 70,000 Burmese refugees between 2008-2016.',
                'Absolute numbers reveal sharp divergence within this decade: established groups like Chinese and Indian immigrants each added 600,000+ people through employment and student pathways, while newer streams exploded from near-invisibility—Nepalese immigrants tripled from 60,000 to 180,000 (accelerating after Nepal\'s 2015 earthquakes), Burmese populations doubled as Rohingya and ethnic minority refugees fled military persecution, and Afghan/Iraqi interpreters arrived through Special Immigrant Visas following U.S. troop drawdowns. Yet "Other Asian" grew by 140,000 during this same period, not from one emerging group but from measurement lag: Mongolians, Central Asians, and secondary migrants from refugee camps who didn\'t fit 2010 Census\'s newly expanded but still insufficient checkbox list.',
                'The raw population curves mask a critical inflection point: 2010\'s Census form updates added "Bhutanese" and "Burmese" checkboxes, temporarily reducing "Other Asian" by disaggregating 140,000 refugees—but within five years, new arrivals refilled this residual category with Afghan interpreters, Rohingya asylum seekers, and Uzbek/Kazakh immigrants fleeing Central Asian instability. By 2019, "Other Asian" exceeded 700,000 and "Other NHPI" reached 260,000—together comprising nearly 1 million AAPI immigrants whose population growth, occupational concentration, and health outcomes remain unmeasured. When 2009-2019 growth charts show smooth trajectories, they obscure how one-quarter of AAPI population increase occurred in communities that federal data systems don\'t separately track, can\'t monitor for disparities, and effectively treat as statistical noise rather than distinct populations needing culturally specific services.'
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
                'Pacific Islander immigrant populations grew from 310,000 in 2009 to 390,000 in 2019—an 80,000-person increase (26%) that appears modest until disaggregation reveals the crisis underneath. Samoan immigrants grew from 48,000 to 57,000 (+9,000), Tongans from 18,000 to 24,000 (+6,000), and Chamorros from 12,000 to 13,000 (+1,000). But "Other NHPI" exploded from 190,000 to 275,000—adding 85,000 people and comprising 106% of total NHPI immigrant growth. This isn\'t mathematical error; it\'s measurement collapse. The entire decade\'s Pacific Islander immigration growth occurred in the unmeasured residual category while specified groups grew minimally.',
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
                'Indexed scaling transforms "Other NHPI" from statistical artifact to public health catastrophe: the 45% growth from 2009-2019 correlates with communities facing housing discrimination (Micronesian families in Honolulu paying 60% of income on rent), occupational concentration in injury-prone sectors (meatpacking, construction, hospitality), and health crises invisible to federal surveillance systems. Hawaii\'s COVID-19 response revealed what aggregation hides: when the state finally disaggregated data in 2020, Marshallese residents showed infection rates of 10,580 per 100,000—seven times "Pacific Islander" averages. But this granular data emerged only through community-led contact tracing, not federal surveillance. The 2024 federal standards finally mandate Marshallese enumeration, but implementation lags. Until then, 45% "Other NHPI" growth represents the decade\'s fastest-growing Pacific Islander populations spending 2009-2019 entirely outside federal measurement systems.'
            ]
        }
	};

	// Generate key based on current state
	// For Growth view with scale, include scale in key; otherwise just view-scope
	$: stateKey =
		activeScale && activeView === 'Growth Over Time'
			? `${activeView.toLowerCase()}-${activeScope.toLowerCase()}-${activeScale.toLowerCase()}`.replace(
					/\s+/g,
					'-'
				)
			: `${activeView.toLowerCase()}-${activeScope.toLowerCase()}`.replace(/\s+/g, '-');

	// Select content based on state, fallback to default
	$: currentContent = content[stateKey] || content.default;
</script>

<section class="intro-below">
	<div class="site-container">
		<h2 class="intro-title">{currentContent.title}</h2>

		<!-- 3-column responsive text block -->
		<div class="intro-columns">
			{#each currentContent.paragraphs as paragraph}
				<p>{paragraph}</p>
			{/each}
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
