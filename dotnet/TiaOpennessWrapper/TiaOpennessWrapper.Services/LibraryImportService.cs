using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.Library;
using Siemens.Engineering.Library.Types;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.ExternalSources;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services;

public class LibraryImportService
{
	public Task<object> ExportLibraryTypesAsync(ProjectBase? currentProject, string exportPath, TiaExportOptions options)
	{
		return ExportInternalAsync(currentProject, exportPath, null, null, options);
	}

	public Task<object> ExportLibraryFolderAsync(ProjectBase? currentProject, string folderPath, string exportPath, TiaExportOptions options)
	{
		return ExportInternalAsync(currentProject, exportPath, SplitFolderPath(folderPath), null, options);
	}

	public Task<object> ExportLibraryTypeAsync(ProjectBase? currentProject, string folderPath, string typeName, string exportPath, TiaExportOptions options)
	{
		return ExportInternalAsync(currentProject, exportPath, SplitFolderPath(folderPath), typeName, options);
	}

	private async Task<object> ExportInternalAsync(ProjectBase? currentProject, string exportPath, string[]? folderPathSegments, string? singleTypeName, TiaExportOptions options)
	{
		return await Task.Run((Func<object>)delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			ExportCounters exportCounters = new ExportCounters();
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected"
					};
				}
				ProjectLibrary projectLibrary;
				try
				{
					projectLibrary = ((ProjectBase)currentProject).ProjectLibrary;
				}
				catch (Exception ex)
				{
					return new
					{
						success = false,
						error = "Project library not accessible: " + ex.Message
					};
				}
				if (projectLibrary == null)
				{
					return new
					{
						success = false,
						error = "Project library not available"
					};
				}
				LibraryTypeSystemFolder typeFolder;
				try
				{
					typeFolder = projectLibrary.TypeFolder;
				}
				catch (Exception ex2)
				{
					return new
					{
						success = false,
						error = "Type folder not accessible: " + ex2.Message
					};
				}
				if (typeFolder == null)
				{
					return new
					{
						success = false,
						error = "Type folder not available"
					};
				}
				LibraryTypeFolder val = (LibraryTypeFolder)(object)typeFolder;
				if (folderPathSegments != null && folderPathSegments.Length != 0)
				{
					string[] array = folderPathSegments;
					foreach (string b in array)
					{
						LibraryTypeUserFolder val2 = null;
						foreach (LibraryTypeUserFolder folder in val.Folders)
						{
							if (string.Equals(folder.Name, b, StringComparison.Ordinal))
							{
								val2 = folder;
								break;
							}
						}
						if (val2 == null)
						{
							return new
							{
								success = false,
								error = "Library folder not found: " + string.Join("/", folderPathSegments)
							};
						}
						val = (LibraryTypeFolder)(object)val2;
					}
				}
				Directory.CreateDirectory(exportPath);
				string requestedFormat = (options?.Format ?? "xml").ToLowerInvariant();
				PlcSoftware sclHost = FindAnyPlcSoftware(currentProject);
				if (singleTypeName != null)
				{
					LibraryType val3 = null;
					foreach (LibraryType type in val.Types)
					{
						if (string.Equals(type.Name, singleTypeName, StringComparison.Ordinal))
						{
							val3 = type;
							break;
						}
					}
					if (val3 == null)
					{
						return new
						{
							success = false,
							error = "Library type not found: " + singleTypeName
						};
					}
					ExportLibraryType(val3, exportPath, requestedFormat, sclHost, list, exportCounters);
				}
				else
				{
					ExportFolderRecursive(val, exportPath, requestedFormat, sclHost, list, exportCounters);
				}
				return new
				{
					success = true,
					itemCount = exportCounters.Success,
					successCount = exportCounters.Success,
					errorCount = exportCounters.Error,
					skippedCount = exportCounters.Skipped,
					messages = list
				};
			}
			catch (Exception ex3)
			{
				list.Add(ExportMessage.Error("ImportLibrary", "Operation", ex3.Message, ex3.ToString()));
				return new
				{
					success = false,
					error = ex3.Message,
					messages = list
				};
			}
		});
	}

	private void ExportFolderRecursive(LibraryTypeFolder folder, string outputDir, string requestedFormat, PlcSoftware? sclHost, List<ExportMessage> messages, ExportCounters counters)
	{
		foreach (LibraryType type in folder.Types)
		{
			ExportLibraryType(type, outputDir, requestedFormat, sclHost, messages, counters);
		}
		foreach (LibraryTypeUserFolder folder2 in folder.Folders)
		{
			string name = folder2.Name;
			if (!string.IsNullOrEmpty(name))
			{
				string text = Path.Combine(outputDir, SanitizeFileName(name));
				Directory.CreateDirectory(text);
				ExportFolderRecursive((LibraryTypeFolder)(object)folder2, text, requestedFormat, sclHost, messages, counters);
			}
		}
	}

	private void ExportLibraryType(LibraryType type, string outputDir, string requestedFormat, PlcSoftware? sclHost, List<ExportMessage> messages, ExportCounters counters)
	{
		string text = type.Name ?? "Unknown";
		string safeTypeName = SanitizeFileName(text);
		List<LibraryTypeVersion> list = ((IEnumerable<LibraryTypeVersion>)type.Versions)?.ToList() ?? new List<LibraryTypeVersion>();
		if (list.Count == 0)
		{
			messages.Add(ExportMessage.Warning("ImportLibrary", text, "Type has no versions"));
			counters.Skipped++;
			return;
		}
		LibraryTypeVersion val = list.FirstOrDefault((LibraryTypeVersion v) => SafeIsDefault(v)) ?? list.Last();
		string versionLabel = SafeVersion(val);
		string sdFormatName = null;
		string fallbackReason;
		string text2 = ResolveEffectiveFormat(requestedFormat, type, val, out fallbackReason, out sdFormatName);
		if (text2 != requestedFormat && requestedFormat != "xml" && fallbackReason != null)
		{
			messages.Add(ExportMessage.Info(text, "LibraryType", "Format '" + requestedFormat + "' falls back to '" + text2 + "' for this type (" + fallbackReason + ")."));
		}
		try
		{
			if (text2 == "sd" && sdFormatName != null)
			{
				ExportAsSd(val, text, safeTypeName, versionLabel, outputDir, sdFormatName, messages, counters);
			}
			else if (text2 == "scl")
			{
				ExportAsScl(val, text, safeTypeName, versionLabel, outputDir, sclHost, messages, counters);
			}
			else
			{
				ExportAsXml(val, text, safeTypeName, versionLabel, outputDir, messages, counters);
			}
		}
		catch (Exception ex)
		{
			counters.Error++;
			messages.Add(ExportMessage.Error("ImportLibrary", text, ex.Message, ex.ToString()));
		}
	}

	private static string ResolveEffectiveFormat(string requested, LibraryType type, LibraryTypeVersion version, out string? fallbackReason, out string? sdFormatName)
	{
		fallbackReason = null;
		sdFormatName = null;
		if (requested != "sd")
		{
			if (requested == "scl")
			{
				return "scl";
			}
			if (requested == "db")
			{
				fallbackReason = "no source-format export for project library types";
			}
			return "xml";
		}
		_ = TiaCapabilities.SupportsSdFormat;
		fallbackReason = "SD format requires TIA Portal V20 or newer";
		return "xml";
	}

	private static bool IsSclLanguage(ProgrammingLanguage lang)
	{
		//IL_0000: Unknown result type (might be due to invalid IL or missing references)
		//IL_0002: Invalid comparison between Unknown and I4
		return (int)lang == 4;
	}

	private static void ExportAsXml(LibraryTypeVersion target, string typeName, string safeTypeName, string versionLabel, string outputDir, List<ExportMessage> messages, ExportCounters counters)
	{
		Directory.CreateDirectory(outputDir);
		string text = Path.Combine(outputDir, safeTypeName + ".xml");
		if (File.Exists(text))
		{
			File.Delete(text);
		}
		target.Export(new FileInfo(text), (ExportOptions)1);
		counters.Success++;
		messages.Add(ExportMessage.Success(typeName, "LibraryType", text, "Exported v" + versionLabel + " (XML)"));
	}

	private static void ExportAsSd(LibraryTypeVersion target, string typeName, string safeTypeName, string versionLabel, string outputDir, string sdFormatName, List<ExportMessage> messages, ExportCounters counters)
	{
		ExportAsXml(target, typeName, safeTypeName, versionLabel, outputDir, messages, counters);
	}

	private static void ExportAsScl(LibraryTypeVersion target, string typeName, string safeTypeName, string versionLabel, string outputDir, PlcSoftware? sclHost, List<ExportMessage> messages, ExportCounters counters)
	{
		object obj = null;
		try
		{
			obj = target.TypeObject;
		}
		catch
		{
		}
		if (sclHost != null)
		{
			IGenerateSource val = (IGenerateSource)((obj is IGenerateSource) ? obj : null);
			if (val != null)
			{
				Directory.CreateDirectory(outputDir);
				string text = Path.Combine(outputDir, safeTypeName + ".scl");
				if (File.Exists(text))
				{
					try
					{
						File.Delete(text);
					}
					catch
					{
					}
				}
				try
				{
					sclHost.ExternalSourceGroup.GenerateSource((IEnumerable<IGenerateSource>)(object)new IGenerateSource[1] { val }, new FileInfo(text), (GenerateOptions)0);
					counters.Success++;
					messages.Add(ExportMessage.Success(typeName, "LibraryType", text, "Exported v" + versionLabel + " (SCL)"));
					return;
				}
				catch (Exception ex)
				{
					messages.Add(ExportMessage.Info(typeName, "LibraryType", "SCL export failed (" + ex.Message + "); falling back to XML."));
					ExportAsXml(target, typeName, safeTypeName, versionLabel, outputDir, messages, counters);
					return;
				}
			}
		}
		messages.Add(ExportMessage.Info(typeName, "LibraryType", (sclHost == null) ? "No PlcSoftware found in project to host SCL source generation; falling back to XML." : "Type does not implement IGenerateSource; falling back to XML."));
		ExportAsXml(target, typeName, safeTypeName, versionLabel, outputDir, messages, counters);
	}

	private static PlcSoftware? FindAnyPlcSoftware(ProjectBase project)
	{
		try
		{
			foreach (Device device in project.Devices)
			{
				PlcSoftware val = FindPlcInDeviceItems(((HardwareObject)device).DeviceItems);
				if (val != null)
				{
					return val;
				}
			}
		}
		catch
		{
		}
		return null;
	}

	private static PlcSoftware? FindPlcInDeviceItems(DeviceItemComposition items)
	{
		if (items == null)
		{
			return null;
		}
		foreach (DeviceItem item in items)
		{
			try
			{
				SoftwareContainer service = item.GetService<SoftwareContainer>();
				Software obj = ((service != null) ? service.Software : null);
				PlcSoftware val = (PlcSoftware)(object)((obj is PlcSoftware) ? obj : null);
				if (val != null)
				{
					return val;
				}
			}
			catch
			{
			}
			PlcSoftware val2 = FindPlcInDeviceItems(((HardwareObject)item).DeviceItems);
			if (val2 != null)
			{
				return val2;
			}
		}
		return null;
	}

	private static bool SafeIsDefault(LibraryTypeVersion v)
	{
		try
		{
			return v.IsDefault;
		}
		catch
		{
			return false;
		}
	}

	private static string SafeVersion(LibraryTypeVersion v)
	{
		try
		{
			return v.VersionNumber?.ToString() ?? "?";
		}
		catch
		{
			return "?";
		}
	}

	private static string[] SplitFolderPath(string? folderPath)
	{
		if (string.IsNullOrEmpty(folderPath))
		{
			return Array.Empty<string>();
		}
		string text = folderPath.Replace('\\', '/');
		if (text.StartsWith("Library/Types/", StringComparison.Ordinal))
		{
			text = text.Substring("Library/Types/".Length);
		}
		else if (text.StartsWith("Types/", StringComparison.Ordinal))
		{
			text = text.Substring("Types/".Length);
		}
		return text.Split(new char[1] { '/' }, StringSplitOptions.RemoveEmptyEntries);
	}

	private static string SanitizeFileName(string name)
	{
		if (string.IsNullOrEmpty(name))
		{
			return "_";
		}
		char[] invalid = Path.GetInvalidFileNameChars();
		return new string(name.Select((char c) => (!invalid.Contains(c)) ? c : '_').ToArray());
	}
}

