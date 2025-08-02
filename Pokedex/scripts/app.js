// Get references to main DOM elements
const listContainer = document.getElementById('pokemon-list');
const detailsContainer = document.getElementById('pokemon-details');
const searchInput = document.getElementById('search');
const sidebar = document.querySelector('.sidebar');

// Variables for pagination and state
let offset = 0;
const limit = 20;
let isLoading = false;
let allPokemon = [];
const pokemonCache = new Map();
let selectedPokemon = null;

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Fetches a list of Pokémon from the API and displays them
 */
async function fetchPokemonList() {
  if (isLoading) return; 
  isLoading = true;

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error("Failed to fetch Pokémon list");

    const data = await res.json();
    offset += limit; 

    // Fetch full data for each Pokémon in the list
    const fetches = data.results.map(async (item) => {
      try {
        const pokemonRes = await fetch(item.url);
        if (!pokemonRes.ok) throw new Error();
        const pokemon = await pokemonRes.json();
        allPokemon.push(pokemon); 
        renderListItem(pokemon); 
      } catch {
        console.warn(`Failed to fetch details for ${item.name}`);
      }
    });

    await Promise.all(fetches); 
  } catch (err) {
    console.error("Error fetching Pokémon list:", err);
  }

  isLoading = false;
}

/**
 * Renders one Pokémon in the list (sidebar)
 */
function renderListItem(pokemon) {
  const item = document.createElement('div');
  item.classList.add('pokemon-item');

  // Highlight the selected Pokémon
  if (selectedPokemon && selectedPokemon.id === pokemon.id) {
    item.classList.add('selected');
  }

  item.innerHTML = `
    <div style="display: flex; align-items: center;">
      <img src="${pokemon.sprites.front_default}" alt="${pokemon.name}" />
      <span class="pokemon-name">${capitalize(pokemon.name)}</span>
    </div>
    <span class="pokemon-code">#${pokemon.id.toString().padStart(3, '0')}</span>
  `;

  // When clicked, show Pokémon details
  item.addEventListener('click', () => {
    document.querySelectorAll('.pokemon-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    selectedPokemon = pokemon;
    showPokemonDetails(pokemon);
  });

  listContainer.appendChild(item);
}

/**
 * Shows Pokémon details, using cache if possible
 */
function showPokemonDetails(pokemon) {
  if (pokemonCache.has(pokemon.name)) {
    displayPokemonDetails(pokemonCache.get(pokemon.name));
    return;
  }

  displayPokemonDetails(pokemon);
  pokemonCache.set(pokemon.name, pokemon);
}

/**
 * Displays detailed info about the selected Pokémon
 */
function displayPokemonDetails(pokemon) {
  const types = pokemon.types
    .map(t => `<span class="type-badge">${capitalize(t.type.name)}</span>`)
    .join(' ');

  detailsContainer.innerHTML = `
    <div class="pokemon-details-container">
      <div class="pokemon-main-section">
        <div class="pokemon-basic-info">
          <img src="${pokemon.sprites.other['official-artwork'].front_default}" alt="${pokemon.name}" />
          <h3>${capitalize(pokemon.name)}</h3>
          <div class="pokemon-types">${types}</div>
        </div>

        <div class="pokemon-stats-details">
          <ul class="stats-list">
            <li class="info-title"><strong>Information</strong></li>
            <li><strong>Weight:</strong> ${pokemon.weight / 10} kg</li>
            <li><strong>Height:</strong> ${pokemon.height / 10} m</li>
            <li><strong>Abilities:</strong> ${pokemon.abilities.map(a => capitalize(a.ability.name)).join(', ')}</li>
            <li id="species-info"><strong>Species:</strong> Loading...</li>
          </ul>
        </div>
      </div>

      <div class="evolution-divider"></div>

      <div class="evolution-container" id="evolution">
        <h4>Evolution Chart</h4>
        <div class="evolution-sequence" id="evolution-sequence"></div>
      </div>
    </div>
  `;

  fetchSpecies(pokemon.species.url);
}

/**
 * Gets extra info from the species endpoint and then loads evolution data
 */
async function fetchSpecies(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();

    const data = await res.json();
    const speciesInfo = document.getElementById('species-info');

    if (speciesInfo) {
      const genus = data.genera.find(g => g.language.name === 'en');
      speciesInfo.innerHTML = `<strong>Species:</strong> ${capitalize(genus.genus)}`;
    }

    loadEvolutionChain(data.evolution_chain.url);
  } catch {
    console.error("Failed to fetch species data");
    const speciesInfo = document.getElementById('species-info');
    if (speciesInfo) {
      speciesInfo.innerHTML = `<strong>Species:</strong> Unknown`;
    }
  }
}

/**
 * Loads and displays the evolution chain for a Pokémon
 */
async function loadEvolutionChain(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();

    const evoData = await res.json();
    const evoChain = [];

    // Loop through the evolution chain
    let evo = evoData.chain;
    while (evo) {
      evoChain.push(evo.species.name);
      evo = evo.evolves_to[0];
    }

    const evolutionSequence = document.getElementById('evolution-sequence');
    evolutionSequence.innerHTML = '';

    for (let i = 0; i < evoChain.length; i++) {
      const name = evoChain[i];
      const found = allPokemon.find(p => p.name === name);
      const id = found ? found.id : '';
      const img = id
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
        : '';

      const evoItem = document.createElement('div');
      evoItem.className = 'evolution-item';
      evoItem.innerHTML = `
        <img src="${img}" alt="${name}" />
        <p>${capitalize(name)}</p>
      `;
      evolutionSequence.appendChild(evoItem);

      // Add arrow between evolutions
      if (i < evoChain.length - 1) {
        const arrow = document.createElement('div');
        arrow.className = 'arrow';
        arrow.textContent = '→';
        evolutionSequence.appendChild(arrow);
      }
    }
  } catch {
    console.error("Failed to load evolution chain");
    document.getElementById('evolution').innerHTML = '<p>No evolution data available</p>';
  }
}

/**
 * Filters Pokémon based on search input
 * If not found in list, tries fetching directly from the API
 */
searchInput.addEventListener('input', async () => {
  const searchTerm = searchInput.value.toLowerCase().trim();
  listContainer.innerHTML = '';

  if (!searchTerm) {
    allPokemon.forEach(p => renderListItem(p));
    return;
  }

  const filtered = allPokemon.filter(p => p.name.includes(searchTerm));

  if (filtered.length > 0) {
    filtered.forEach(p => renderListItem(p));
  } else {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${searchTerm}`);
      if (!res.ok) throw new Error();

      const pokemon = await res.json();
      if (!allPokemon.find(p => p.id === pokemon.id)) {
        allPokemon.push(pokemon);
      }

      renderListItem(pokemon);
    } catch {
      listContainer.innerHTML = `<p style="color:white; padding:0.5rem;">No Pokémon found.</p>`;
    }
  }
});

/**
 * Infinite scroll: fetch more Pokémon when near bottom of sidebar
 */
let scrollTimeout;
const scrollContainer = document.querySelector('.pokemon-list-scroll');

scrollContainer.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);

  scrollTimeout = setTimeout(() => {
    const threshold = 50;
    const nearBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - threshold;

    if (nearBottom) fetchPokemonList();
  }, 150); 
});

// Initial fetch when the page loads
fetchPokemonList();
