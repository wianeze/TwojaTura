param([string[]]$Only)

Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\wiane\Documents\Codex\2026-07-03\chc-zbudowa-mvp-1-prywatnej-aplikacji\public\assets\quests"
# removeBg / tol are set explicitly per master rather than auto-detected: the
# five files genuinely differ (black margin, flat-ish grey gradient, or gold
# bleeding to the edge with no background at all) and a heuristic that guesses
# wrong silently eats the artwork. Values verified by looking at each file.
#
# crop  = ile pikseli obciac z KAZDEJ strony mastera przed obrobka.
# slice = 0 -> zmierz automatycznie; >0 -> wymus konkretna wartosc.
#
# Te dwa pola sluza do zrownania OPTYCZNEJ grubosci ramy miedzy rarity.
# Renderowana grubosc = band * (grubosc_ciemnego_pasa / slice). Zielony master
# ma ciemny pas 62px, fioletowy 83px - przy tym samym slice 325 zielony
# wychodzil ~25% cienszy. Mniejszy slice skaluje ramke w gore, nie ruszajac
# samej grafiki: 35.2 * 62 / 250 = 8.7px wobec 35.2 * 83 / 325 = 9.0px.
#
# crop = 15 to DOKLADNIE margines mastera (tresc zaczyna sie na x=15); wiecej
# obcinalo narozne klejnoty. Ten crop pozwala zejsc ze slice do 250 bez
# przecinania motywu rogu, ktory siega 265px w nieprzycietym pliku.
$items = @(
  @{ key = "white";  src = "white-quest-poprawione.png";  removeBg = $true;  tol = 26; crop = 29; slice = 300; bg = "black"; fade = 90 },
  @{ key = "green";  src = "green-quest-poprawione.png";  removeBg = $true;  tol = 26; crop = 15; slice = 265; bg = "black"; fade = 90 },
  @{ key = "blue";   src = "blue-quest-poprawione.png";   removeBg = $true;  tol = 55; crop = 12; slice = 270; bg = "auto";  fade = 8  },
  @{ key = "purple"; src = "purple-quest-poprawione.png"; removeBg = $true;  tol = 26; crop = 0;  slice = 0;   bg = "auto";  fade = 90 },
  @{ key = "orange"; src = "orange-quest-poprawione.png"; removeBg = $false; tol = 0;  crop = 0;  slice = 0;   bg = "auto";  fade = 90 }
)

$MARGIN = 60      # safety added to the measured corner extent
# FADE jest teraz per-asset (pole `fade`): szerokosc crossfade z bloku rogu
# w plaski pas. Duzy fade ladnie wygasza wic z naroznika, ale JEDNOCZESNIE
# przenosi oryginalna grafike rogu w pas krawedzi - a ten jest rozciagany
# poziomo, wiec dlugi zawijas (niebieski) wychodzil rozjechany. Maly fade
# wycina go czysto na granicy bloku rogu.

function Get-Pixels {
  param([string]$Path, [int]$Crop = 0)
  $bmp = [System.Drawing.Bitmap]::FromFile($Path)
  if ($Crop -gt 0) {
    $cw = $bmp.Width - 2 * $Crop; $ch = $bmp.Height - 2 * $Crop
    $cut = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($cut)
    $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch),
                       (New-Object System.Drawing.Rectangle $Crop, $Crop, $cw, $ch),
                       [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose(); $bmp.Dispose(); $bmp = $cut
  }
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $stride = $data.Stride
  $bmp.Dispose()
  return @{ Bytes = $bytes; W = $w; H = $h; Stride = $stride }
}

function Save-Pixels {
  param($Bytes, [int]$W, [int]$H, [string]$Path)
  $bmp = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  [System.Runtime.InteropServices.Marshal]::Copy($Bytes, 0, $data.Scan0, $Bytes.Length)
  $bmp.UnlockBits($data)
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Median3 {
  param($List)
  $r = $List[0]; $g = $List[1]; $b = $List[2]
  $r.Sort(); $g.Sort(); $b.Sort()
  $m = [int]($r.Count / 2)
  return @($r[$m], $g[$m], $b[$m])
}

foreach ($it in $items) {
  # hoist to plain locals: the loop body below is long and defines nested
  # functions, and reading $it.* at the far end proved unreliable
  $key = [string]$it.key
  if ($Only -and ($Only -notcontains $key)) { continue }
  $doBg = [bool]$it.removeBg
  $tolCfg = [int]$it.tol
  $cropCfg = [int]$it.crop
  $sliceCfg = [int]$it.slice
  $bgCfg = [string]$it.bg
  $FADE = [int]$it.fade
  $path = Join-Path $dir $it.src
  if (-not (Test-Path $path)) { Write-Output "${key}: MISSING $($it.src)"; continue }
  $img = Get-Pixels -Path $path -Crop $cropCfg
  $b = $img.Bytes; $W = $img.W; $H = $img.H; $stride = $img.Stride

  # ---------- 1) measure the corner motif extent on both axes ----------
  $probe = [Math]::Min(460, [int]($H / 2))
  $mx0 = [int]($W / 2) - 100; $mx1 = [int]($W / 2) + 100
  $rowMed = @{}
  for ($y = 0; $y -lt $probe; $y++) {
    $L = @((New-Object 'System.Collections.Generic.List[int]'), (New-Object 'System.Collections.Generic.List[int]'), (New-Object 'System.Collections.Generic.List[int]'))
    $rb = $y * $stride
    for ($x = $mx0; $x -lt $mx1; $x++) { $i = $rb + $x * 4; $L[2].Add($b[$i]); $L[1].Add($b[$i+1]); $L[0].Add($b[$i+2]) }
    $rowMed[$y] = Median3 $L
  }
  $en = @{}
  for ($x = 0; $x -lt [int]($W / 2); $x += 5) {
    $s = 0
    for ($y = 0; $y -lt $probe; $y++) {
      $m = $rowMed[$y]; $i = $y * $stride + $x * 4
      $s += [Math]::Abs($b[$i+2] - $m[0]) + [Math]::Abs($b[$i+1] - $m[1]) + [Math]::Abs($b[$i] - $m[2])
    }
    $en[$x] = $s
  }
  $vals = ($en.Values | Sort-Object)
  $base = $vals[[int]($vals.Count * 0.5)]
  # walk OUTWARD from the corner and stop at the first sustained quiet run;
  # taking the largest index instead would latch onto the mid-side gem
  $cornerX = 0; $run = 0
  foreach ($k in ($en.Keys | Sort-Object)) {
    if ($k -gt [int]($W * 0.42)) { break }
    if ($en[$k] -gt ($base * 1.8 + 4000)) { $cornerX = $k; $run = 0 }
    else { $run++; if ($run -ge 6) { break } }
  }

  $probeV = [Math]::Min(460, [int]($W / 2))
  $my0 = [int]($H / 2) - 100; $my1 = [int]($H / 2) + 100
  $colMed = @{}
  for ($x = 0; $x -lt $probeV; $x++) {
    $L = @((New-Object 'System.Collections.Generic.List[int]'), (New-Object 'System.Collections.Generic.List[int]'), (New-Object 'System.Collections.Generic.List[int]'))
    for ($y = $my0; $y -lt $my1; $y++) { $i = $y * $stride + $x * 4; $L[2].Add($b[$i]); $L[1].Add($b[$i+1]); $L[0].Add($b[$i+2]) }
    $colMed[$x] = Median3 $L
  }
  $enV = @{}
  for ($y = 0; $y -lt [int]($H / 2); $y += 5) {
    $s = 0
    for ($x = 0; $x -lt $probeV; $x++) {
      $m = $colMed[$x]; $i = $y * $stride + $x * 4
      $s += [Math]::Abs($b[$i+2] - $m[0]) + [Math]::Abs($b[$i+1] - $m[1]) + [Math]::Abs($b[$i] - $m[2])
    }
    $enV[$y] = $s
  }
  $valsV = ($enV.Values | Sort-Object)
  $baseV = $valsV[[int]($valsV.Count * 0.5)]
  $cornerY = 0; $runV = 0
  foreach ($k in ($enV.Keys | Sort-Object)) {
    if ($k -gt [int]($H * 0.42)) { break }
    if ($enV[$k] -gt ($baseV * 1.8 + 4000)) { $cornerY = $k; $runV = 0 }
    else { $runV++; if ($runV -ge 6) { break } }
  }

  if ($sliceCfg -gt 0) { $S = $sliceCfg } else { $S = [Math]::Max($cornerX, $cornerY) + $MARGIN }
  $S = [Math]::Min($S, [int]([Math]::Min($W, $H) / 2) - 40)
  if ($S -lt ([Math]::Max($cornerX, $cornerY))) {
    Write-Output ("{0}: UWAGA slice {1} < zasieg rogu {2} - rog zostanie przeciety" -f `
      $key, $S, [Math]::Max($cornerX, $cornerY))
  }

  # ---------- 2) linearise all four edge strips ----------
  # Each strip pixel is replaced by a LINEAR RAMP between the strip's own two
  # ends, computed per row (top/bottom) or per column (left/right).
  #
  # Why a ramp and not a median: a median collapses the strip to one constant,
  # which also destroys the artwork's long vignette/gradient - and the mismatch
  # between that constant and the untouched middle showed up as visible
  # rectangular banding. A ramp keeps the gradient, and because it is EXACT at
  # both ends it joins the corner blocks with no seam at all. Anything discrete
  # in between (central gem, inlay pattern, mid-side gem) is simply gone, and a
  # linear ramp survives any amount of stretching without artefacts - which is
  # what removes the squashed-side-gem problem on a short card.
  #
  # innerFade takes the effect to 0 towards the strip's INNER edge, so the
  # boundary with the untouched middle is pixel-identical to the original and
  # the centre cannot visually detach. The ornamented part of a strip lives in
  # its outer ~third, well inside the fully-processed region.
  $snapshot = New-Object byte[] $b.Length
  [Array]::Copy($b, $snapshot, $b.Length)
  $inner = 0.55

  foreach ($zone in @("top", "bottom")) {
    $y0 = $(if ($zone -eq "top") { 0 } else { $H - $S })
    $y1 = $(if ($zone -eq "top") { $S } else { $H })
    for ($y = $y0; $y -lt $y1; $y++) {
      $rb = $y * $stride
      $iL = $rb + $S * 4
      $iR = $rb + ($W - $S - 1) * 4
      $span = ($W - $S - 1) - $S
      $d = $(if ($zone -eq "top") { $S - 1 - $y } else { $y - ($H - $S) })
      $f = $d / [double]($S - 1)          # 0 at the inner edge, 1 at the outer
      $wt = $(if ($f -ge (1 - $inner)) { 1.0 } else { $f / (1 - $inner) })
      for ($x = $S; $x -lt $W - $S; $x++) {
        $t = ($x - $S) / [double]$span
        $i = $rb + $x * 4
        for ($c = 0; $c -lt 3; $c++) {
          $ramp = $snapshot[$iL + $c] + ($snapshot[$iR + $c] - $snapshot[$iL + $c]) * $t
          $b[$i + $c] = [byte][int]($snapshot[$i + $c] * (1 - $wt) + $ramp * $wt)
        }
      }
    }
  }

  foreach ($zone in @("left", "right")) {
    $x0 = $(if ($zone -eq "left") { 0 } else { $W - $S })
    $x1 = $(if ($zone -eq "left") { $S } else { $W })
    for ($x = $x0; $x -lt $x1; $x++) {
      $iT = $S * $stride + $x * 4
      $iB = ($H - $S - 1) * $stride + $x * 4
      $span = ($H - $S - 1) - $S
      $d = $(if ($zone -eq "left") { $S - 1 - $x } else { $x - ($W - $S) })
      $f = $d / [double]($S - 1)
      $wt = $(if ($f -ge (1 - $inner)) { 1.0 } else { $f / (1 - $inner) })
      for ($y = $S; $y -lt $H - $S; $y++) {
        $t = ($y - $S) / [double]$span
        $i = $y * $stride + $x * 4
        for ($c = 0; $c -lt 3; $c++) {
          $ramp = $snapshot[$iT + $c] + ($snapshot[$iB + $c] - $snapshot[$iT + $c]) * $t
          $b[$i + $c] = [byte][int]($snapshot[$i + $c] * (1 - $wt) + $ramp * $wt)
        }
      }
    }
  }

  # ---------- 3) outside background -> transparent (only if there IS one) ----------
  # Flood fill inward from the border over pixels close to the border colour.
  # Handles black (white/green/purple) and flat grey (blue) alike, and leaves
  # orange - whose gold bleeds to the edge - fully opaque.
  # Reference colour = the four image corners. Comparing each candidate against
  # this FIXED colour (never against its neighbour) is essential: a
  # neighbour-relative tolerance lets the fill drift along smooth gradients and
  # swallow the whole picture.
  $cs = @()
  foreach ($cxy in @(@(0,0), @(($W-10),0), @(0,($H-10)), @(($W-10),($H-10)))) {
    $sr = 0; $sg = 0; $sb = 0; $n = 0
    for ($dy = 0; $dy -lt 10; $dy++) {
      for ($dx = 0; $dx -lt 10; $dx++) {
        $i = ($cxy[1] + $dy) * $stride + ($cxy[0] + $dx) * 4
        $sb += $b[$i]; $sg += $b[$i+1]; $sr += $b[$i+2]; $n++
      }
    }
    $cs += , @(($sr / $n), ($sg / $n), ($sb / $n))
  }
  $agree = $doBg
  $TOL = $tolCfg
  # The background can be a GRADIENT (blue), so the reference is a bilinear
  # surface through the four corner samples rather than a single colour - a
  # single colour left a grey rim that a 9-slice would show as a halo.
  $tl = $cs[0]; $tr = $cs[1]; $bl = $cs[2]; $br = $cs[3]
  # ...ale probka z rogow obrazu dziala TYLKO wtedy, gdy rogi to naprawde tlo.
  # Przy `crop` rogi trafiaja juz w grafike ramy, referencja przestaje byc
  # czarna i flood fill nie dopasowuje czarnego marginesu - zostawia czarne
  # placki przy krawedzi (dokladnie to bylo widac pod zielona ramka).
  # `bg = "black"` wymusza wtedy stala, czarna referencje.
  if ($bgCfg -eq "black") { $tl = @(0,0,0); $tr = @(0,0,0); $bl = @(0,0,0); $br = @(0,0,0) }

  $out = New-Object byte[] ($W * $H)
  $pct = 0.0
  if ($agree) {
    $q = New-Object 'System.Collections.Generic.Queue[int]'
    function Match { param([int]$x, [int]$y)
      $u = $x / [double]($W - 1); $v = $y / [double]($H - 1)
      $i = $y * $stride + $x * 4
      for ($c = 0; $c -lt 3; $c++) {
        $top = $tl[$c] + ($tr[$c] - $tl[$c]) * $u
        $bot = $bl[$c] + ($br[$c] - $bl[$c]) * $u
        $ref = $top + ($bot - $top) * $v
        # cs channels are R,G,B; buffer is B,G,R
        $val = $b[$i + (2 - $c)]
        if ([Math]::Abs($val - $ref) -gt $TOL) { return $false }
      }
      return $true
    }
    function Seed { param([int]$x, [int]$y)
      $p = $y * $W + $x
      if ($out[$p] -ne 0) { return }
      if (-not (Match $x $y)) { return }
      $out[$p] = 1; $q.Enqueue($p)
    }
    for ($x = 0; $x -lt $W; $x++) { Seed $x 0; Seed $x ($H - 1) }
    for ($y = 0; $y -lt $H; $y++) { Seed 0 $y; Seed ($W - 1) $y }
    while ($q.Count -gt 0) {
      # UWAGA: [int] w PowerShellu ZAOKRAGLA, nie obcina - [int](1223.7) to 1224.
      # Przy liczeniu wiersza z indeksu piksela dawalo to bledny $py, przez co
      # BFS wychodzil poza swoj wiersz i zatrzymywal sie po 1-2 rzedach.
      # Skutek: czarne tlo bylo usuwane tylko przy samej krawedzi, a reszta
      # zostawala nieprzezroczysta - to byl ten ciemny przeswit za ramka.
      $p = $q.Dequeue(); $py = [Math]::Floor($p / $W); $px = $p % $W
      foreach ($d in @(@(1,0), @(-1,0), @(0,1), @(0,-1))) {
        $nx = $px + $d[0]; $ny = $py + $d[1]
        if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $W -or $ny -ge $H) { continue }
        $np = $ny * $W + $nx
        if ($out[$np] -ne 0) { continue }
        if (Match $nx $ny) { $out[$np] = 1; $q.Enqueue($np) }
      }
    }
    $cov = 0
    for ($p = 0; $p -lt $out.Length; $p++) { if ($out[$p] -eq 1) { $cov++ } }
    $pct = 100.0 * $cov / ($W * $H)
  }

  # prog celowo niski: po `crop` z mastera zostaje juz tylko czarny klin przy
  # zaokraglonych rogach (rzedu 1% powierzchni), a to wciaz trzeba wyciac
  if ($pct -gt 0.2 -and $pct -lt 60) {
    # Tlo -> CALKOWICIE przezroczyste. Wczesniej piksele przy granicy
    # dostawaly plaska alfe 90 "dla zmiekczenia" - w praktyce wychodzil z tego
    # ciemny, w 35% nieprzezroczysty rant dookola calej karty, widoczny jako
    # przeswit za ramka. Zadnego feathera: albo tlo (0), albo grafika.
    for ($y = 0; $y -lt $H; $y++) {
      $rb = $y * $stride
      for ($x = 0; $x -lt $W; $x++) {
        if ($out[$y * $W + $x] -eq 1) { $b[$rb + $x * 4 + 3] = 0 }
      }
    }
  }

  Save-Pixels -Bytes $b -W $W -H $H -Path (Join-Path $dir "$key-quest-frame.png")
  Write-Output ("{0}: {1}x{2}  cornerX={3} cornerY={4} -> SLICE={5}  bgRemoved={6} ({7:N1}%)" -f `
    $key, $W, $H, $cornerX, $cornerY, $S, ($pct -gt 0.2 -and $pct -lt 60), $pct)
}
