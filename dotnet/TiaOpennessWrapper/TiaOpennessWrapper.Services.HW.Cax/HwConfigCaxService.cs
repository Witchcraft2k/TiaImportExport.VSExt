using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.Cax;
using Siemens.Engineering.HW;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Export;
using TiaOpennessWrapper.Services.Import;

namespace TiaOpennessWrapper.Services.HW.Cax;

public class HwConfigCaxService
{
	public const string FileExtension = ".aml";

	public CaxOperationResult ExportProject(ProjectBase project, string targetFolder, List<ExportMessage> messages)
	{
		if (project == null)
		{
			throw new ArgumentNullException("project");
		}
		Project val = project as Project;
		if (val == null)
		{
			return CaxOperationResult.Failure("Project-level CAx export requires a standard TIA project instance.");
		}
		Directory.CreateDirectory(targetFolder);
		CaxProvider provider = GetProvider(val, messages);
		if (provider == null)
		{
			return CaxOperationResult.Failure("CAx provider is not available on this project.");
		}
		string text = SanitizeFileName(project.Name ?? "Project");
		string text2 = Path.Combine(targetFolder, text + ".aml");
		string text3 = CreateTempLogPath(text, "CaxExport");
		try
		{
			provider.Export(val, new FileInfo(text2), new FileInfo(text3));
			EmitLogToMessages(text3, text, "CAx", messages);
			messages.Add(ExportMessage.Success(text, "CAx", "Exported project to " + text2));
			return CaxOperationResult.Ok(text2, text3);
		}
		catch (Exception ex)
		{
			EmitLogToMessages(text3, text, "CAx", messages);
			string text4 = ErrorHelper.ExtractFullErrorMessage(ex);
			messages.Add(ExportMessage.Error(text, "CAx", "Project CAx export failed", text4));
			return CaxOperationResult.Failure(text4);
		}
		finally
		{
			TryDeleteFile(text3);
		}
	}

	public CaxOperationResult ExportDevice(Device device, string targetFolder, List<ExportMessage> messages)
	{
		if (device == null)
		{
			throw new ArgumentNullException("device");
		}
		Directory.CreateDirectory(targetFolder);
		Project val = FindParentProject((IEngineeringObject)(object)device);
		if (val == null)
		{
			string text = "Could not resolve parent Project for device.";
			messages.Add(ExportMessage.Error(((HardwareObject)device).Name, "CAx", text));
			return CaxOperationResult.Failure(text);
		}
		CaxProvider provider = GetProvider(val, messages);
		if (provider == null)
		{
			return CaxOperationResult.Failure("CAx provider is not available on this project.");
		}
		string text2 = SafeDisplayName(device);
		string text3 = SanitizeFileName(text2);
		string text4 = Path.Combine(targetFolder, text3 + ".aml");
		string text5 = CreateTempLogPath(text3, "CaxExport");
		try
		{
			provider.Export(device, new FileInfo(text4), new FileInfo(text5));
			EmitLogToMessages(text5, text2, "CAx", messages);
			messages.Add(ExportMessage.Success(text2, "CAx", "Exported device to " + text4));
			return CaxOperationResult.Ok(text4, text5);
		}
		catch (Exception ex)
		{
			EmitLogToMessages(text5, text2, "CAx", messages);
			string text6 = ErrorHelper.ExtractFullErrorMessage(ex);
			messages.Add(ExportMessage.Error(text2, "CAx", "Device CAx export failed", text6));
			return CaxOperationResult.Failure(text6);
		}
		finally
		{
			TryDeleteFile(text5);
		}
	}

	public CaxOperationResult ImportFile(ProjectBase project, string amlFilePath, CaxImportOptions importOption, List<ExportMessage> messages)
	{
		//IL_0063: Unknown result type (might be due to invalid IL or missing references)
		//IL_0085: Unknown result type (might be due to invalid IL or missing references)
		if (project == null)
		{
			throw new ArgumentNullException("project");
		}
		if (!File.Exists(amlFilePath))
		{
			return CaxOperationResult.Failure("File not found: " + amlFilePath);
		}
		CaxProvider provider = GetProvider(project, messages);
		if (provider == null)
		{
			return CaxOperationResult.Failure("CAx provider is not available on this project.");
		}
		string fileName = Path.GetFileName(amlFilePath);
		string text = CreateTempLogPath(Path.GetFileNameWithoutExtension(amlFilePath), "CaxImport");
		try
		{
			provider.Import(new FileInfo(amlFilePath), new FileInfo(text), importOption);
			EmitLogToMessages(text, fileName, "CAx", messages);
			messages.Add(ExportMessage.Success(fileName, "CAx", $"Imported AML file (option: {importOption})"));
			return CaxOperationResult.Ok(amlFilePath, text);
		}
		catch (Exception ex)
		{
			EmitLogToMessages(text, fileName, "CAx", messages);
			string text2 = ErrorHelper.ExtractFullErrorMessage(ex);
			messages.Add(ExportMessage.Error(fileName, "CAx", "CAx import failed", text2));
			return CaxOperationResult.Failure(text2);
		}
		finally
		{
			TryDeleteFile(text);
		}
	}

	public static CaxImportOptions ResolveImportOption(HwConfigExportToTiaOptions options)
	{
		if (!options.OverwriteExisting)
		{
			if (!options.UpdateExisting)
			{
				return (CaxImportOptions)0;
			}
			return (CaxImportOptions)2;
		}
		return (CaxImportOptions)1;
	}

	private static CaxProvider? GetProvider(ProjectBase project, List<ExportMessage> messages)
	{
		try
		{
			CaxProvider service = project.GetService<CaxProvider>();
			if (service == null)
			{
				messages.Add(ExportMessage.Warning(project.Name ?? "Project", "CAx", "CaxProvider service is not available on this project."));
			}
			return service;
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Warning(((ProjectBase)project).Name ?? "Project", "CAx", "Failed to obtain CaxProvider: " + ex.Message));
			return null;
		}
	}

	private static Project? FindParentProject(IEngineeringObject obj)
	{
		for (IEngineeringObject val = ((obj != null) ? ((IEngineeringInstance)obj).Parent : null); val != null; val = ((IEngineeringInstance)val).Parent)
		{
			Project val2 = (Project)(object)((val is Project) ? val : null);
			if (val2 != null)
			{
				return val2;
			}
		}
		return null;
	}

	private static string SafeDisplayName(Device device)
	{
		try
		{
			return DeviceItemHelper.GetDeviceDisplayName(device);
		}
		catch
		{
			return ((HardwareObject)device).Name ?? "Device";
		}
	}

	private static string SanitizeFileName(string name)
	{
		if (string.IsNullOrEmpty(name))
		{
			return "Unnamed";
		}
		char[] invalid = Path.GetInvalidFileNameChars();
		return new string(name.Select((char c) => (!invalid.Contains(c)) ? c : '_').ToArray());
	}

	private static string CreateTempLogPath(string baseName, string suffix)
	{
		string text = SanitizeFileName(baseName);
		string text2 = Guid.NewGuid().ToString("N").Substring(0, 8);
		return Path.Combine(Path.GetTempPath(), text + "_" + suffix + "_" + text2 + ".log");
	}

	private static void EmitLogToMessages(string logPath, string source, string category, List<ExportMessage> messages)
	{
		try
		{
			if (string.IsNullOrEmpty(logPath) || !File.Exists(logPath))
			{
				return;
			}
			string[] array = File.ReadAllLines(logPath);
			foreach (string text in array)
			{
				if (!string.IsNullOrWhiteSpace(text))
				{
					messages.Add(ExportMessage.Info(source, category, text.TrimEnd()));
				}
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Warning(source, category, "Failed to read CAx log: " + ex.Message));
		}
	}

	private static void TryDeleteFile(string path)
	{
		try
		{
			if (!string.IsNullOrEmpty(path) && File.Exists(path))
			{
				File.Delete(path);
			}
		}
		catch
		{
		}
	}
}
