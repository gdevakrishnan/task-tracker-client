export const calculateWorkerProductivity = (productivityParameters) => {
  const {
    attendanceData,
    fromDate,
    toDate,
    options = {}
  } = productivityParameters;

  const {
    considerOvertime = false,
    deductSalary = true,
    permissionTimeMinutes = 15,
    salaryDeductionPerBreak = 10,
    batches = [],
    lunchFrom = '12:00',
    lunchTo = '13:00',
    intervals = [],
    fiteredBatch = 'Full Time'
  } = options;

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return hours * 60 + minutes + seconds / 60;
  };

  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const parseAttendanceTime = (timeStr) => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(' ');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    let totalMinutes = minutes + (seconds || 0) / 60;
    if (period === 'AM') {
      totalMinutes += (hours === 12 ? 0 : hours) * 60;
    } else if (period === 'PM') {
      totalMinutes += (hours === 12 ? 12 : hours + 12) * 60;
    } else {
      totalMinutes += hours * 60;
    }
    return totalMinutes;
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    return `${day.toString().padStart(2, '0')} ${month}`;
  };

  const isDateInRange = (date, fromDate, toDate) => {
    const checkDate = new Date(date);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    checkDate.setHours(0, 0, 0, 0);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return checkDate >= from && checkDate <= to;
  };

  const isSingleDay = new Date(fromDate).toDateString() === new Date(toDate).toDateString();

  const selectedBatch = batches.find(batch => batch.batchName === fiteredBatch);
  const workStartTime = selectedBatch ? selectedBatch.from : '09:00';
  const workEndTime = selectedBatch ? selectedBatch.to : '19:00';

  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const lunchStart = timeToMinutes(lunchFrom);
  const lunchEnd = timeToMinutes(lunchTo);

  let standardWorkingMinutes = workEnd - workStart;
  standardWorkingMinutes -= (lunchEnd - lunchStart);
  intervals.forEach(interval => {
    const intervalStart = timeToMinutes(interval.from);
    const intervalEnd = timeToMinutes(interval.to);
    standardWorkingMinutes -= (intervalEnd - intervalStart);
  });

  const filteredData = attendanceData.filter(record =>
    isDateInRange(record.date, fromDate, toDate)
  );

  if (filteredData.length === 0) {
    return { ...emptyResponse() };
  }

  const worker = filteredData[0].worker || {};
  const originalSalary = worker.salary || 0;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const assumedWorkingDays = daysInMonth - 4;

  const perDaySalary = assumedWorkingDays > 0 ? originalSalary / assumedWorkingDays : 0;
  const perMinuteSalary = standardWorkingMinutes > 0 ? perDaySalary / standardWorkingMinutes : 0;
  const totalExpectedMinutes = assumedWorkingDays * standardWorkingMinutes;

  let totalWorkingMinutes = 0;
  let totalPermissionMinutes = 0;
  let dailyBreakdown = [];
  let punctualityViolations = 0;
  let report = [];

  const processDay = (punches, date) => {
    const dayData = {
      date,
      punchTime: punches.length === 1 ? punches[0].originalTime : `${punches[0].originalTime} - ${punches[punches.length - 1].originalTime}`,
      workingMinutes: 0,
      permissionMinutes: 0,
      salaryDeduction: 0,
      issues: []
    };

    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];

    let effectiveWorkStart = Math.max(firstPunch.time, workStart);
    let effectiveWorkEnd = punches.length > 1 ? Math.min(lastPunch.time, workEnd) : workEnd;
    let permissionTime = 0;

    if (firstPunch.time > workStart) {
      const lateMinutes = firstPunch.time - workStart;
      if (lateMinutes <= permissionTimeMinutes) {
        permissionTime += lateMinutes;
        dayData.issues.push(`Late arrival: ${Math.round(lateMinutes)} minutes (within permission)`);
      } else {
        permissionTime += permissionTimeMinutes;
        const excessLateMinutes = lateMinutes - permissionTimeMinutes;
        punctualityViolations++;
        dayData.issues.push(`Excessive late arrival: ${Math.round(excessLateMinutes)} minutes`);
      }
    }

    if (lastPunch.time < workEnd && punches.length > 1) {
      const earlyMinutes = workEnd - lastPunch.time;
      if (earlyMinutes > permissionTimeMinutes) {
        const excessEarlyMinutes = earlyMinutes - permissionTimeMinutes;
        dayData.issues.push(`Early departure: ${Math.round(excessEarlyMinutes)} minutes`);
      }
    }

    let dayWorkingMinutes = effectiveWorkEnd > effectiveWorkStart ? effectiveWorkEnd - effectiveWorkStart : 0;

    // Subtract lunch time only if isLunchConsider is false
    if (!options.isLunchConsider && effectiveWorkStart < lunchEnd && effectiveWorkEnd > lunchStart) {
      const overlap = Math.min(effectiveWorkEnd, lunchEnd) - Math.max(effectiveWorkStart, lunchStart);
      dayWorkingMinutes -= Math.max(0, overlap);
    }

    // Subtract only intervals where isBreakConsider is false
    intervals.forEach(interval => {
      if (!interval.isBreakConsider) {
        const start = timeToMinutes(interval.from);
        const end = timeToMinutes(interval.to);
        if (effectiveWorkStart < end && effectiveWorkEnd > start) {
          const overlap = Math.min(effectiveWorkEnd, end) - Math.max(effectiveWorkStart, start);
          dayWorkingMinutes -= Math.max(0, overlap);
        }
      }
    });

    dayData.workingMinutes = Math.max(0, dayWorkingMinutes);
    dayData.permissionMinutes = permissionTime;
    dayData.salaryDeduction = permissionTime * perMinuteSalary;

    // Create report entry
    const reportEntry = {
      date: formatDate(date),
      inTime: formatTime(firstPunch.time),
      outTime: punches.length > 1 ? formatTime(lastPunch.time) : '-',
      workedHours: (dayData.workingMinutes / 60).toFixed(2) + ' hrs',
      permissionMins: Math.round(permissionTime),
      deduction: formatCurrency(dayData.salaryDeduction)
    };

    report.push(reportEntry);
    totalWorkingMinutes += dayData.workingMinutes;
    totalPermissionMinutes += permissionTime;
    dailyBreakdown.push(dayData);
  };

  if (isSingleDay) {
    const punches = filteredData.map(record => ({
      time: parseAttendanceTime(record.time),
      originalTime: record.time,
      record
    })).sort((a, b) => a.time - b.time);

    if (punches.length > 0) {
      processDay(punches, punches[0].record.date);
    }
  } else {
    const groupedByDate = {};
    filteredData.forEach(record => {
      const dateKey = new Date(record.date).toDateString();
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(record);
    });

    Object.keys(groupedByDate).forEach(dateKey => {
      const punches = groupedByDate[dateKey].map(record => ({
        time: parseAttendanceTime(record.time),
        originalTime: record.time,
        record
      })).sort((a, b) => a.time - b.time);
      if (punches.length > 0) processDay(punches, punches[0].record.date);
    });
  }

  const totalDays = dailyBreakdown.length;
  const productivityPercentage = totalExpectedMinutes > 0 ? (totalWorkingMinutes / totalExpectedMinutes) * 100 : 0;
  const averageWorkingHours = totalDays > 0 ? (totalWorkingMinutes / totalDays) / 60 : 0;
  const punctualityScore = totalDays > 0 ? ((totalDays - punctualityViolations) / totalDays) * 100 : 0;
  const attendanceRate = 100;

  const finalSalary = totalExpectedMinutes > 0
    ? (originalSalary * totalWorkingMinutes) / totalExpectedMinutes
    : 0;

  const totalSalaryDeduction = originalSalary - finalSalary;
  const originalSalaryForPeriod = originalSalary;

  // Create the final summary in the requested format
  const finalSummary = {
    "Total Working Hours": `${(totalWorkingMinutes / 60).toFixed(2)} hours`,
    "Total Permission Time": `${Math.round(totalPermissionMinutes)} minutes`,
    "Total Salary Deductions": formatCurrency(totalSalaryDeduction),
    "Final Salary": formatCurrency(finalSalary)
  };

  return {
    // Original structure maintained for backward compatibility
    totalDays,
    workingDays: totalDays,
    totalWorkingHours: totalWorkingMinutes / 60,
    averageWorkingHours,
    totalPermissionTime: totalPermissionMinutes,
    totalSalaryDeduction,
    productivityPercentage,
    dailyBreakdown: dailyBreakdown.map(day => ({
      ...day,
      workingHours: day.workingMinutes / 60,
      permissionTime: day.permissionMinutes,
      workingTimeDisplay: minutesToTime(day.workingMinutes),
      permissionTimeDisplay: minutesToTime(day.permissionMinutes),
      daySalaryFromMinutes: day.workingMinutes * perMinuteSalary,
      expectedDaySalary: perDaySalary
    })),
    summary: {
      punctualityScore,
      attendanceRate,
      finalSalary,
      originalSalary,
      originalSalaryForPeriod,
      salaryFromWorkingMinutes: finalSalary,
      perMinuteSalary,
      perDaySalary,
      workingDaysInMonth: assumedWorkingDays,
      worker: {
        name: worker.name || '',
        username: worker.username || '',
        rfid: worker.rfid || '',
        department: worker.department || '',
        email: worker.email || '',
        salary: worker.salary || 0
      }
    },
    configuration: {
      considerOvertime,
      deductSalary,
      workStartTime,
      workEndTime,
      lunchStartTime: lunchFrom,
      lunchEndTime: lunchTo,
      permissionTimeMinutes,
      salaryDeductionPerBreak,
      standardWorkingMinutesPerDay: standardWorkingMinutes
    },
    // New formatted data as requested
    finalSummary,
    report
  };
};

function emptyResponse() {
  return {
    totalDays: 0,
    workingDays: 0,
    totalWorkingHours: 0,
    averageWorkingHours: 0,
    totalPermissionTime: 0,
    totalSalaryDeduction: 0,
    productivityPercentage: 0,
    dailyBreakdown: [],
    summary: {
      punctualityScore: 0,
      attendanceRate: 0,
      finalSalary: 0,
      originalSalary: 0,
      perMinuteSalary: 0,
      worker: {
        name: '',
        username: '',
        rfid: '',
        department: '',
        email: '',
        perDaySalary: 0
      }
    },
    configuration: {},
    finalSummary: {
      "Total Working Hours": "0 hours",
      "Total Permission Time": "0 minutes",
      "Total Salary Deductions": "₹0.00",
      "Final Salary": "₹0.00"
    },
    report: []
  };
}