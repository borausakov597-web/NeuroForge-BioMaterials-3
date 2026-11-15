// NeuroForge BioMaterials — frontend demo logic

document.addEventListener('DOMContentLoaded', () => {
  // --- Mobile menu ---
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.style.display === 'flex';
      nav.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) {
        nav.style.flexDirection = 'column';
        nav.style.position = 'absolute';
        nav.style.top = '64px';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.background = '#F8FAFC';
        nav.style.padding = '20px 24px';
        nav.style.borderBottom = '1px solid #E2E8F0';
        nav.style.gap = '16px';
        nav.style.zIndex = '99';
      }
    });
  }

  document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900 && nav) nav.style.display = 'none';
    });
  });

  // --- Demo upload & process ---
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const uploadContent = document.getElementById('upload-content');
  const uploadPreview = document.getElementById('upload-preview');
  const previewImg = document.getElementById('preview-img');
  const changeBtn = document.getElementById('change-btn');
  const processBtn = document.getElementById('process-btn');
  const statusText = document.getElementById('status-text');
  const progressBox = document.getElementById('progress-box');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const resultsBox = document.getElementById('results-box');
  const downloadStl = document.getElementById('download-stl');

  const patientForm = document.getElementById('patient-form');
  let selectedFile = null;

  if (!uploadZone) return;

  uploadZone.addEventListener('click', (e) => {
    if (e.target === changeBtn) return;
    fileInput.click();
  });

  changeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    selectedFile = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    uploadContent.classList.add('hidden');
    uploadPreview.classList.remove('hidden');
    processBtn.disabled = false;
    statusText.textContent = file.name;
    resultsBox.classList.add('hidden');
    progressBox.classList.add('hidden');
  }

  processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    // Проверка анкеты пациента
    let formOk = true;
    patientForm.querySelectorAll('.field').forEach(f => {
      const input = f.querySelector('input, select');
      const bad = !input.checkValidity();
      f.classList.toggle('invalid', bad);
      if (bad) formOk = false;
    });
    if (!formOk) {
      statusText.textContent = 'Заполните данные пациента (возраст 18–95, рост 120–230 см, вес 30–250 кг).';
      patientForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    processBtn.disabled = true;
    resultsBox.classList.add('hidden');
    progressBox.classList.remove('hidden');
    progressFill.style.width = '10%';
    progressLabel.textContent = 'Загрузка снимка…';
    statusText.textContent = '';

    const stages = [
      { pct: 25, label: 'Сегментация области…' },
      { pct: 45, label: 'Генерация геометрии (gyroid)…' },
      { pct: 65, label: 'Расчёт прочности (surrogate)…' },
      { pct: 80, label: 'Подбор материала…' },
      { pct: 92, label: 'Формирование STL…' },
    ];

    let stageIdx = 0;
    const progressInterval = setInterval(() => {
      if (stageIdx < stages.length) {
        progressFill.style.width = stages[stageIdx].pct + '%';
        progressLabel.textContent = stages[stageIdx].label;
        stageIdx++;
      }
    }, 700);

    try {
      const form = new FormData();
      form.append('file', selectedFile);
      const pd = new FormData(patientForm);
      for (const [k, v] of pd.entries()) form.append(k, v);
      form.set('smoker', pd.has('smoker') ? 'true' : 'false');

      const res = await fetch('/api/process', {
        method: 'POST',
        body: form,
      });

      clearInterval(progressInterval);
      progressFill.style.width = '100%';
      progressLabel.textContent = 'Готово';

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Проверьте введённые данные');
      }

      const data = await res.json();
      showResults(data);
    } catch (err) {
      clearInterval(progressInterval);
      progressLabel.textContent = 'Ошибка';
      statusText.textContent = err.message || 'Не удалось обработать снимок. Убедитесь, что сервер запущен.';
      console.error(err);
    } finally {
      processBtn.disabled = false;
      setTimeout(() => progressBox.classList.add('hidden'), 800);
    }
  });

  function showResults(data) {
    resultsBox.classList.remove('hidden');

    document.getElementById('res-material').textContent =
      data.material_recommendation?.material || 'PCL';
    document.getElementById('res-structure').textContent =
      data.material_recommendation?.structure || 'Gyroid / TPMS';
    document.getElementById('res-modulus').textContent =
      (data.metrics?.young_modulus_mpa || '—') + ' МПа';
    document.getElementById('res-porosity').textContent =
      data.metrics?.porosity_target != null
        ? Math.round(data.metrics.porosity_target * 100) + '%'
        : '—';
    document.getElementById('res-fit').textContent =
      (data.metrics?.fit_error_mm || '—') + ' мм';
    document.getElementById('res-time').textContent =
      (data.metrics?.design_time_sec || '—') + ' сек';

    document.getElementById('res-bmi').textContent = data.metrics?.bmi ?? '—';
    document.getElementById('res-load').textContent = data.metrics?.load_index ?? '—';
    document.getElementById('res-bone').textContent = data.metrics?.bone_quality_index ?? '—';

    const adjBox = document.getElementById('adjustments-box');
    const adjList = document.getElementById('adjustments-list');
    adjList.innerHTML = '';
    (data.adjustments || []).forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      adjList.appendChild(li);
    });
    adjBox.classList.toggle('hidden', !(data.adjustments || []).length);

    document.getElementById('res-disclaimer').textContent =
      data.disclaimer || 'Research Use Only. Упрощённый прототип.';

    if (data.mesh?.stl_url) {
      downloadStl.href = data.mesh.stl_url;
      downloadStl.classList.remove('hidden');
    } else {
      downloadStl.classList.add('hidden');
    }

    resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
