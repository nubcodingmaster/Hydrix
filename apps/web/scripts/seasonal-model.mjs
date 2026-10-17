/** Seasonal rainfall models. All hindcasts train strictly before their target year. */
export const round = n => Number(n.toFixed(1));
const median = values => { const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2; };
const features = id => { const angle=2*Math.PI*(Number(id.slice(5))-1)/12;return [1,Math.sin(angle),Math.cos(angle),Math.sin(2*angle),Math.cos(2*angle),Math.sin(3*angle),Math.cos(3*angle)]; };
function solve(matrix,vector) {
    const a=matrix.map((row,i)=>[...row,vector[i]]),n=vector.length;
    for(let c=0;c<n;c++) {
        let pivot=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[pivot][c]))pivot=r;
        [a[c],a[pivot]]=[a[pivot],a[c]];const div=a[c][c];if(Math.abs(div)<1e-10)throw new Error('Singular seasonal model');
        for(let k=c;k<=n;k++)a[c][k]/=div;
        for(let r=0;r<n;r++)if(r!==c){const factor=a[r][c];for(let k=c;k<=n;k++)a[r][k]-=factor*a[c][k];}
    }
    return a.map(row=>row[n]);
}
export function fitSeasonal(history,method) {
    const rows=history.filter(m=>Number.isFinite(m.rain)&&m.rain>=0);
    const byMonth=Array.from({length:12},(_,i)=>rows.filter(m=>Number(m.id.slice(5))===i+1).map(m=>m.rain));
    if(byMonth.some(values=>values.length<10))throw new Error('Insufficient seasonal training observations');
    if(method==='monthly-median') { const values=byMonth.map(median);return id=>values[Number(id.slice(5))-1]; }
    const n=7,xtx=Array.from({length:n},()=>Array(n).fill(0)),xty=Array(n).fill(0);
    for(const row of rows){const x=features(row.id);for(let a=0;a<n;a++){xty[a]+=x[a]*row.rain;for(let b=0;b<n;b++)xtx[a][b]+=x[a]*x[b];}}
    for(let i=1;i<n;i++)xtx[i][i]+=1;
    const weights=solve(xtx,xty);
    return id=>Math.max(0,features(id).reduce((sum,x,i)=>sum+x*weights[i],0));
}

export function buildClimatology(history) {
    const valid = history.filter(row => /^\d{4}-(0[1-9]|1[0-2])$/.test(row.id) && Number.isFinite(row.rain) && row.rain >= 0);

    return Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const values = valid.filter(row => Number(row.id.slice(5)) === month).map(row => row.rain);

        if (values.length < 20) {
            throw new Error(`Insufficient climatology observations for month ${month}`);
        }

        const normal = median(values);

        return {
            month,
            medianMm: round(normal),
            observations: values.length,
        };
    });
}


export function classifyRainfallAnomaly(projected, lower, upper, historicalMedian) {
    if (![projected, lower, upper, historicalMedian].every(Number.isFinite) || historicalMedian <= 0 || lower > projected || projected > upper) {
        return {
            status: 'insufficient-data',
            deviationPercent: null,
            signal: 'uncertain',
        };
    }

    const deviationPercent = ((projected - historicalMedian) / historicalMedian) * 100;

    // Threshold screening awal, bukan standar resmi BMKG.
    const threshold = 20;
    const lowerThreshold = historicalMedian * (1 - threshold / 100);
    const upperThreshold = historicalMedian * (1 + threshold / 100);

    let status = 'near-normal';

    if (deviationPercent < -threshold) {
        status = 'below-normal';
    } else if (deviationPercent > threshold) {
        status = 'above-normal';
    }

    let signal = 'uncertain';

    if (upper < lowerThreshold) {
        signal = 'below-normal';
    } else if (lower > upperThreshold) {
        signal = 'above-normal';
    }

    return {
        status,
        deviationPercent: round(deviationPercent),
        signal,
    };
}


export function hindcast(history,method,startYear,endYear) {
    const result=[];
    for(let year=startYear;year<=endYear;year++) {
        const training=history.filter(m=>m.id<`${year}-01`),predict=fitSeasonal(training,method);
        for(const actual of history.filter(m=>m.id.startsWith(String(year))&&m.rain!==null))result.push({id:actual.id,actual:actual.rain,predicted:predict(actual.id),trainingEnd:training.at(-1).id});
    }
    return result;
}
const mae = rows => rows.reduce((sum,r)=>sum+Math.abs(r.actual-r.predicted),0)/rows.length;
export function buildProjection(history,issuedAt,pixel) {
    const issueMonth=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',timeZone:'Asia/Makassar'}).format(new Date(issuedAt));
    if(history.some(m=>m.id>=issueMonth))throw new Error('Future or incomplete-month training observations are not allowed');
    const valid=history.filter(m=>Number.isFinite(m.rain)&&m.rain>=0).sort((a,b)=>a.id.localeCompare(b.id));
    if(valid.length<300)throw new Error('At least 25 years of monthly observations are required');
    const methods=['monthly-median','harmonic-ridge'];
    const selection=methods.map(method=>({method,mae:mae(hindcast(valid,method,2010,2014))}));
    const best=selection[1].mae<selection[0].mae*.98?selection[1]:selection[0];
    const calibration=hindcast(valid,best.method,2015,2019),errors=calibration.map(r=>Math.abs(r.actual-r.predicted)).sort((a,b)=>a-b);
    const radius=errors[Math.min(errors.length-1,Math.ceil((errors.length+1)*.8)-1)];
    const evaluation=hindcast(valid,best.method,2020,2024),baseline=hindcast(valid,'monthly-median',2020,2024);
    const coverage=evaluation.filter(r=>r.actual>=Math.max(0,r.predicted-radius)&&r.actual<=r.predicted+radius).length/evaluation.length;
    const predict=fitSeasonal(valid,best.method);
    const climatology = buildClimatology(valid);
    // Full months after the issue month, not dates shifted from the observation year.
    const [year,month]=issueMonth.split('-').map(Number);
    const months=Array.from({length:12},(_,i)=>{
        const id=new Date(Date.UTC(year,month+i,1)).toISOString().slice(0,7),rain=predict(id);
        const lower = Math.max(0, rain - radius);
        const upper = rain + radius;
        const historicalMedian = climatology[Number(id.slice(5)) - 1].medianMm;
        const anomaly = classifyRainfallAnomaly(rain, lower, upper, historicalMedian,);

        return {
            id,
            rain: round(rain),
            lower: round(lower),
            upper: round(upper),
            anomaly,
        };
    });
    return {pixel,issuedAt,kind:'seasonal-projection', climatology, method:best.method,training:{start:valid[0].id,end:valid.at(-1).id,observations:valid.length},validation:{selectionYears:'2010–2014',calibrationYears:'2015–2019',evaluationYears:'2020–2024',maeMm:round(mae(evaluation)),baselineMaeMm:round(mae(baseline)),intervalCoverage:round(coverage*100),evaluatedMonths:evaluation.length},interval:{nominalCoverage:80,radiusMm:round(radius),method:'split-conformal absolute hindcast errors'},confidence:'low',months,limitations:['Proyeksi pola musiman, bukan prakiraan cuaca harian atau produk BMKG.','Tidak memasukkan prediksi ENSO, sirkulasi atmosfer, suhu, atau kondisi laut mendatang.','Rentang dikalibrasi pada galat historis; cakupan masa depan tidak dijamin.']};
}
