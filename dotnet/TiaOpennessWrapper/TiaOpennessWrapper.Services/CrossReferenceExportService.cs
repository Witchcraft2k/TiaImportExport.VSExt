using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Siemens.Engineering;
using Siemens.Engineering.CrossReference;
using Siemens.Engineering.HW;

namespace TiaOpennessWrapper.Services;

public class CrossReferenceExportService
{
	private class UsageRecord
	{
		[JsonProperty("device")]
		public string? Device { get; set; }

		[JsonProperty("symbol")]
		public string? Symbol { get; set; }

		[JsonProperty("symbolType")]
		public string? SymbolType { get; set; }

		[JsonProperty("symbolAddress")]
		public string? SymbolAddress { get; set; }

		[JsonProperty("symbolPath")]
		public string? SymbolPath { get; set; }

		[JsonProperty("usedIn")]
		public string? UsedIn { get; set; }

		[JsonProperty("usedInPath")]
		public string? UsedInPath { get; set; }

		[JsonProperty("usedInType")]
		public string? UsedInType { get; set; }

		[JsonProperty("usedInDevice")]
		public string? UsedInDevice { get; set; }

		[JsonProperty("usedInAddress")]
		public string? UsedInAddress { get; set; }

		[JsonProperty("access")]
		public string? Access { get; set; }

		[JsonProperty("referenceLocation")]
		public string? ReferenceLocation { get; set; }

		[JsonProperty("referenceType")]
		public string? ReferenceType { get; set; }

		[JsonProperty("referencedAsName")]
		public string? ReferencedAsName { get; set; }

		[JsonProperty("locationName")]
		public string? LocationName { get; set; }

		[JsonProperty("locationAddress")]
		public string? LocationAddress { get; set; }
	}

	private class UnusedRecord
	{
		public string? Symbol { get; set; }

		public string? Type { get; set; }

		public string? Address { get; set; }

		public string? Path { get; set; }
	}

	private readonly IDeviceLocator _devices;

	private static readonly string[] UsageCsvHeader = new string[16]
	{
		"device", "symbol", "symbolType", "symbolAddress", "symbolPath", "usedIn", "usedInPath", "usedInType", "usedInDevice", "usedInAddress",
		"access", "referenceLocation", "referenceType", "referencedAsName", "locationName", "locationAddress"
	};

	public CrossReferenceExportService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	public Task<object> DumpAsync(ProjectBase? project, string deviceId, string outputDirectory, bool includeUnused = true, bool includeMarkdown = true)
	{
		return Task.Run(delegate
		{
			if (project == null)
			{
				return new
				{
					success = false,
					error = "No project selected"
				};
			}
			var (val, val2, obj) = PlcContextResolver.ResolvePlc(_devices, project, deviceId);
			if (obj != null)
			{
				return obj;
			}
			try
			{
				Directory.CreateDirectory(outputDirectory);
				List<UsageRecord> list = new List<UsageRecord>();
				List<UnusedRecord> list2 = new List<UnusedRecord>();
				int symbolCount = 0;
				CrossReferenceService service = val.GetService<CrossReferenceService>();
				if (service != null)
				{
					AppendFromService(service, list, list2, ref symbolCount, includeUnused, ((val2 != null) ? ((HardwareObject)val2).Name : null) ?? "");
				}
				else
				{
					WalkAndAggregate((IEngineeringObject)(object)val, list, list2, ref symbolCount, includeUnused, ((val2 != null) ? ((HardwareObject)val2).Name : null) ?? "");
				}
				if (list.Count == 0 && list2.Count == 0 && symbolCount == 0)
				{
					return new
					{
						success = false,
						error = "CrossReferenceService is not available for this PlcSoftware (TIA Portal V18+ required, Engineering license required)."
					};
				}
				string text = Path.Combine(outputDirectory, "cross-references.jsonl");
				string text2 = Path.Combine(outputDirectory, "cross-references.csv");
				string text3 = Path.Combine(outputDirectory, "unused-symbols.csv");
				list.Sort(delegate(UsageRecord a, UsageRecord b)
				{
					int num = string.Compare(a.SymbolPath ?? "", b.SymbolPath ?? "", StringComparison.OrdinalIgnoreCase);
					if (num != 0)
					{
						return num;
					}
					num = string.Compare(a.Symbol ?? "", b.Symbol ?? "", StringComparison.OrdinalIgnoreCase);
					if (num != 0)
					{
						return num;
					}
					num = string.Compare(a.UsedInPath ?? "", b.UsedInPath ?? "", StringComparison.OrdinalIgnoreCase);
					return (num != 0) ? num : string.Compare(a.ReferenceLocation ?? "", b.ReferenceLocation ?? "", StringComparison.OrdinalIgnoreCase);
				});
				list2.Sort(delegate(UnusedRecord a, UnusedRecord b)
				{
					int num = string.Compare(a.Path ?? "", b.Path ?? "", StringComparison.OrdinalIgnoreCase);
					return (num != 0) ? num : string.Compare(a.Symbol ?? "", b.Symbol ?? "", StringComparison.OrdinalIgnoreCase);
				});
				int count = list.Count;
				int count2 = list2.Count;
				using (StreamWriter streamWriter = new StreamWriter(text, append: false))
				{
					foreach (UsageRecord item in list)
					{
						streamWriter.WriteLine(JsonConvert.SerializeObject(item, Formatting.None, new JsonSerializerSettings
						{
							NullValueHandling = NullValueHandling.Ignore
						}));
					}
				}
				if (includeMarkdown)
				{
					WriteUsagesCsv(text2, list);
				}
				if (includeUnused)
				{
					WriteUnusedCsv(text3, list2);
				}
				return new
				{
					success = true,
					device = ((val2 != null) ? ((HardwareObject)val2).Name : null),
					outputDirectory = outputDirectory,
					files = new
					{
						jsonl = text,
						csv = (includeMarkdown ? text2 : null),
						unused = (includeUnused ? text3 : null)
					},
					symbolCount = symbolCount,
					locationCount = count,
					unusedCount = count2
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message
				};
			}
		});
	}

	private static void AppendFromService(CrossReferenceService crSvc, List<UsageRecord> records, List<UnusedRecord> unused, ref int symbolCount, bool includeUnused, string deviceName)
	{
		try
		{
			foreach (SourceObject source in crSvc.GetCrossReferences((CrossReferenceFilter)1).Sources)
			{
				symbolCount++;
				CollectUsages(source, records, deviceName);
			}
		}
		catch
		{
		}
		if (!includeUnused)
		{
			return;
		}
		try
		{
			foreach (SourceObject src in crSvc.GetCrossReferences((CrossReferenceFilter)3).Sources)
			{
				unused.Add(new UnusedRecord
				{
					Symbol = (SafeString(() => src.Name) ?? ""),
					Type = (SafeString(() => src.TypeName) ?? ""),
					Address = SafeString(() => src.Address),
					Path = SafeString(() => src.Path)
				});
			}
		}
		catch
		{
		}
	}

	private static void WalkAndAggregate(IEngineeringObject root, List<UsageRecord> records, List<UnusedRecord> unused, ref int symbolCount, bool includeUnused, string deviceName, HashSet<object>? visited = null, int depth = 0)
	{
		//IL_0096: Unknown result type (might be due to invalid IL or missing references)
		//IL_00ad: Expected O, but got Unknown
		if (root == null || depth > 12)
		{
			return;
		}
		if (visited == null)
		{
			visited = new HashSet<object>();
		}
		if (!visited.Add(root))
		{
			return;
		}
		CrossReferenceService val = null;
		try
		{
			IEngineeringServiceProvider val2 = (IEngineeringServiceProvider)(object)((root is IEngineeringServiceProvider) ? root : null);
			if (val2 != null)
			{
				val = val2.GetService<CrossReferenceService>();
			}
		}
		catch
		{
			val = null;
		}
		if (val != null)
		{
			AppendFromService(val, records, unused, ref symbolCount, includeUnused, deviceName);
		}
		try
		{
			foreach (EngineeringCompositionInfo compositionInfo in root.GetCompositionInfos())
			{
				try
				{
					IEngineeringCompositionOrObject composition = root.GetComposition(compositionInfo.Name);
					if (composition == null)
					{
						continue;
					}
					IEngineeringComposition val3 = (IEngineeringComposition)(object)((composition is IEngineeringComposition) ? composition : null);
					if (val3 != null)
					{
						foreach (IEngineeringObject item in (IEnumerable)val3)
						{
							WalkAndAggregate(item, records, unused, ref symbolCount, includeUnused, deviceName, visited, depth + 1);
						}
						continue;
					}
					IEngineeringObject val4 = (IEngineeringObject)(object)((composition is IEngineeringObject) ? composition : null);
					if (val4 != null)
					{
						WalkAndAggregate(val4, records, unused, ref symbolCount, includeUnused, deviceName, visited, depth + 1);
					}
				}
				catch
				{
				}
			}
		}
		catch
		{
		}
	}

	private static void CollectUsages(SourceObject src, List<UsageRecord> sink, string deviceName)
	{
		try
		{
			foreach (ReferenceObject refObj in src.References)
			{
				foreach (Location loc in refObj.Locations)
				{
					UsageRecord item = new UsageRecord
					{
						Device = deviceName,
						Symbol = src.Name,
						SymbolType = src.TypeName,
						SymbolAddress = SafeString(() => src.Address),
						SymbolPath = SafeString(() => src.Path),
						UsedIn = SafeString(() => refObj.Name),
						UsedInPath = SafeString(() => refObj.Path),
						UsedInType = SafeString(() => refObj.TypeName),
						UsedInDevice = SafeString(() => refObj.Device),
						UsedInAddress = SafeString(() => refObj.Address),
						Access = SafeString(() => ((object)loc.Access/*cast due to constrained. prefix*/).ToString()),
						ReferenceLocation = SafeString(() => loc.ReferenceLocation),
						ReferenceType = SafeString(() => ((object)loc.ReferenceType/*cast due to constrained. prefix*/).ToString()),
						ReferencedAsName = SafeString(() => loc.ReferencedAsName),
						LocationName = SafeString(() => loc.Name),
						LocationAddress = SafeString(() => loc.Address)
					};
					sink.Add(item);
				}
			}
		}
		catch
		{
		}
		try
		{
			foreach (SourceObject child in src.Children)
			{
				CollectUsages(child, sink, deviceName);
			}
		}
		catch
		{
		}
	}

	private static string? SafeString(Func<string?> getter)
	{
		try
		{
			return getter();
		}
		catch
		{
			return null;
		}
	}

	private static void WriteUsagesCsv(string path, List<UsageRecord> records)
	{
		using StreamWriter streamWriter = new StreamWriter(path, append: false);
		streamWriter.WriteLine(string.Join(",", UsageCsvHeader));
		foreach (UsageRecord record in records)
		{
			streamWriter.WriteLine(string.Join(",", CsvEscape(record.Device), CsvEscape(record.Symbol), CsvEscape(record.SymbolType), CsvEscape(record.SymbolAddress), CsvEscape(record.SymbolPath), CsvEscape(record.UsedIn), CsvEscape(record.UsedInPath), CsvEscape(record.UsedInType), CsvEscape(record.UsedInDevice), CsvEscape(record.UsedInAddress), CsvEscape(record.Access), CsvEscape(record.ReferenceLocation), CsvEscape(record.ReferenceType), CsvEscape(record.ReferencedAsName), CsvEscape(record.LocationName), CsvEscape(record.LocationAddress)));
		}
	}

	private static void WriteUnusedCsv(string path, List<UnusedRecord> unused)
	{
		using StreamWriter streamWriter = new StreamWriter(path, append: false);
		streamWriter.WriteLine("symbol,type,address,path");
		foreach (UnusedRecord item in unused)
		{
			streamWriter.WriteLine(string.Join(",", CsvEscape(item.Symbol), CsvEscape(item.Type), CsvEscape(item.Address), CsvEscape(item.Path)));
		}
	}

	private static string CsvEscape(string? s)
	{
		if (string.IsNullOrEmpty(s))
		{
			return "";
		}
		if (s.IndexOfAny(new char[4] { ',', '"', '\r', '\n' }) < 0)
		{
			return s;
		}
		return "\"" + s.Replace("\"", "\"\"") + "\"";
	}
}
